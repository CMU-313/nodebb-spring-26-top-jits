'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');

const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const utils = require('../../src/utils');
const groups = require('../../src/groups');
const helpers = require('../helpers');
const apiTopics = require('../../src/api/topics');

describe('Topic solved status', () => {
	let cid;
	let tid;
	let ownerUid;
	let otherUid;
	let adminUid;

	before(async () => {
		({ cid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));

		ownerUid = await user.create({ username: utils.generateUUID().slice(0, 8) });
		otherUid = await user.create({ username: utils.generateUUID().slice(0, 8) });
		adminUid = await user.create({ username: utils.generateUUID().slice(0, 8) });
		await groups.join('administrators', adminUid);

		const { topicData } = await topics.post({
			uid: ownerUid,
			cid: cid,
			title: utils.generateUUID(),
			content: utils.generateUUID(),
		});
		tid = topicData.tid;
	});

	describe('topics.tools.solve()', () => {
		it('should allow topic owner to mark as solved', async () => {
			const result = await topics.tools.solve(tid, ownerUid);
			assert.strictEqual(result.solved, 1);
			assert.strictEqual(result.isSolved, true);
		});

		it('should persist solved field on the topic', async () => {
			const topicData = await topics.getTopicField(tid, 'solved');
			assert.strictEqual(parseInt(topicData, 10), 1);
		});

		it('should not allow non-owner to mark as solved', async () => {
			// First unsolve it to test again
			await topics.tools.unsolve(tid, ownerUid);

			await assert.rejects(
				topics.tools.solve(tid, otherUid),
				{ message: '[[error:no-privileges]]' }
			);
		});

		it('should not allow admin (non-owner) to mark as solved', async () => {
			await assert.rejects(
				topics.tools.solve(tid, adminUid),
				{ message: '[[error:no-privileges]]' }
			);
		});

		it('should throw error for non-existent topic', async () => {
			await assert.rejects(
				topics.tools.solve(99999, ownerUid),
				{ message: '[[error:no-topic]]' }
			);
		});
	});

	describe('topics.tools.unsolve()', () => {
		before(async () => {
			// Mark as solved first
			await topics.tools.solve(tid, ownerUid);
		});

		it('should allow topic owner to unsolve', async () => {
			const result = await topics.tools.unsolve(tid, ownerUid);
			assert.strictEqual(result.solved, 0);
			assert.strictEqual(result.isSolved, false);
		});

		it('should persist unsolved field on the topic', async () => {
			const topicData = await topics.getTopicField(tid, 'solved');
			assert.strictEqual(parseInt(topicData, 10), 0);
		});

		it('should not allow non-owner to unsolve', async () => {
			await topics.tools.solve(tid, ownerUid);
			await assert.rejects(
				topics.tools.unsolve(tid, otherUid),
				{ message: '[[error:no-privileges]]' }
			);
		});
	});

	describe('Solved topics filtered from sorted listings', () => {
		let solvedTid;
		let unsolvedTid;
		let filterCid;
		let filterUid;

		before(async () => {
			({ cid: filterCid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			filterUid = await user.create({ username: utils.generateUUID().slice(0, 8) });

			const result1 = await topics.post({
				uid: filterUid,
				cid: filterCid,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			unsolvedTid = result1.topicData.tid;

			const result2 = await topics.post({
				uid: filterUid,
				cid: filterCid,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			solvedTid = result2.topicData.tid;
			await topics.tools.solve(solvedTid, filterUid);
		});

		it('should filter solved topics from getSortedTopics results', async () => {
			const data = await topics.getSortedTopics({
				uid: filterUid,
				start: 0,
				stop: 50,
				cids: [filterCid],
				sort: 'recent',
			});

			const tids = data.topics.map(t => t.tid);
			assert(tids.includes(unsolvedTid), 'Unsolved topic should appear in listing');
			assert(!tids.includes(solvedTid), 'Solved topic should NOT appear in listing');
		});
	});

	describe('API endpoints', () => {
		let apiTid;
		let apiOwnerUid;
		let apiOtherUid;
		let apiCid;

		before(async () => {
			({ cid: apiCid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			apiOwnerUid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			apiOtherUid = await user.create({ username: utils.generateUUID().slice(0, 8) });

			const { topicData } = await topics.post({
				uid: apiOwnerUid,
				cid: apiCid,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			apiTid = topicData.tid;
		});

		it('should solve a topic via API', async () => {
			await apiTopics.solve({ uid: apiOwnerUid }, { tids: [apiTid] });
			const solved = await topics.getTopicField(apiTid, 'solved');
			assert.strictEqual(parseInt(solved, 10), 1);
		});

		it('should unsolve a topic via API', async () => {
			await apiTopics.unsolve({ uid: apiOwnerUid }, { tids: [apiTid] });
			const solved = await topics.getTopicField(apiTid, 'solved');
			assert.strictEqual(parseInt(solved, 10), 0);
		});

		it('should fail to solve when called by non-owner', async () => {
			await assert.rejects(
				apiTopics.solve({ uid: apiOtherUid }, { tids: [apiTid] }),
				{ message: '[[error:no-privileges]]' }
			);
		});

		it('should fail to solve a non-existent topic', async () => {
			await assert.rejects(
				apiTopics.solve({ uid: apiOwnerUid }, { tids: [99999] }),
				{ message: '[[error:no-topic]]' }
			);
		});

		it('should fail with invalid tids', async () => {
			await assert.rejects(
				apiTopics.solve({ uid: apiOwnerUid }, { tids: 'invalid' }),
				{ message: '[[error:invalid-tid]]' }
			);
		});
	});
});
