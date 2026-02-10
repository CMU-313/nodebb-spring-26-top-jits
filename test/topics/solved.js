'use strict';

const assert = require('assert');
const db = require('../mocks/databasemock');
const topics = require('../../src/topics');
const categories = require('../../src/categories');
const privileges = require('../../src/privileges');
const User = require('../../src/user');
const groups = require('../../src/groups');
const apiTopics = require('../../src/api/topics');

describe('Topic Solved Status', () => {
	let questionTopicData;
	let regularTopicData;
	let categoryObj;
	let ownerUid;
	let otherUserUid;
	let adminUid;
	let moderatorUid;

	before(async () => {
		// Create users
		ownerUid = await User.create({ username: 'topicowner', password: '123456' });
		otherUserUid = await User.create({ username: 'otheruser', password: '123456' });
		adminUid = await User.create({ username: 'admin', password: '123456' });
		moderatorUid = await User.create({ username: 'moderator', password: '123456' });

		// Setup privileges
		await groups.join('administrators', adminUid);

		// Create category
		categoryObj = await categories.create({
			name: 'Test Category for Solved',
			description: 'Test category',
		});

		// Make moderatorUid a moderator of the category
		await privileges.categories.give(['moderate'], categoryObj.cid, [moderatorUid]);

		// Create a question-type topic
		questionTopicData = await topics.post({
			cid: categoryObj.cid,
			uid: ownerUid,
			title: 'Test Question Topic',
			content: 'This is a question',
			topicType: 'question',
		});

		// Create a regular note-type topic (default)
		regularTopicData = await topics.post({
			cid: categoryObj.cid,
			uid: ownerUid,
			title: 'Regular Topic',
			content: 'This is a regular post',
		});
	});

	describe('Basic Functionality', () => {
		it('should allow topic owner to mark question as solved', async () => {
			const result = await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);
			assert.strictEqual(result.solved, 1);
			assert.strictEqual(result.isSolved, true);

			const topicData = await topics.getTopicData(questionTopicData.topicData.tid);
			assert.strictEqual(topicData.solved, 1);
		});

		it('should allow topic owner to mark question as unsolved', async () => {
			await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);
			const result = await topics.tools.unsolve(questionTopicData.topicData.tid, ownerUid);
			assert.strictEqual(result.solved, 0);
			assert.strictEqual(result.isSolved, false);

			const topicData = await topics.getTopicData(questionTopicData.topicData.tid);
			assert.strictEqual(topicData.solved, 0);
		});

		it('should have solved field in topic data', async () => {
			const topicData = await topics.getTopicData(questionTopicData.topicData.tid);
			assert(topicData.hasOwnProperty('solved'));
			assert.strictEqual(typeof topicData.solved, 'number');
		});

		it('should initialize new topics with solved: 0', async () => {
			const newQuestionTopic = await topics.post({
				cid: categoryObj.cid,
				uid: ownerUid,
				title: 'New Question',
				content: 'Another question',
				topicType: 'question',
			});

			const topicData = await topics.getTopicData(newQuestionTopic.topicData.tid);
			assert.strictEqual(topicData.solved, 0);
		});
	});

	describe('Permissions', () => {
		it('should allow admin to mark question as solved', async () => {
			await topics.tools.unsolve(questionTopicData.topicData.tid, ownerUid);
			const result = await topics.tools.solve(questionTopicData.topicData.tid, adminUid);
			assert.strictEqual(result.solved, 1);
		});

		it('should allow moderator to mark question as solved', async () => {
			await topics.tools.unsolve(questionTopicData.topicData.tid, ownerUid);
			const result = await topics.tools.solve(questionTopicData.topicData.tid, moderatorUid);
			assert.strictEqual(result.solved, 1);
		});

		it('should not allow non-privileged user to mark others\' questions as solved', async () => {
			await topics.tools.unsolve(questionTopicData.topicData.tid, ownerUid);
			try {
				await topics.tools.solve(questionTopicData.topicData.tid, otherUserUid);
				assert.fail('Should have thrown an error');
			} catch (err) {
				assert.strictEqual(err.message, '[[error:no-privileges]]');
			}
		});

		it('should not allow non-privileged user to mark others\' questions as unsolved', async () => {
			await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);
			try {
				await topics.tools.unsolve(questionTopicData.topicData.tid, otherUserUid);
				assert.fail('Should have thrown an error');
			} catch (err) {
				assert.strictEqual(err.message, '[[error:no-privileges]]');
			}
		});
	});

	describe('Validation', () => {
		it('should throw error when trying to mark non-question topic as solved', async () => {
			try {
				await topics.tools.solve(regularTopicData.topicData.tid, ownerUid);
				assert.fail('Should have thrown an error');
			} catch (err) {
				assert.strictEqual(err.message, '[[error:topic-not-question]]');
			}
		});

		it('should throw error when trying to mark non-question topic as unsolved', async () => {
			try {
				await topics.tools.unsolve(regularTopicData.topicData.tid, ownerUid);
				assert.fail('Should have thrown an error');
			} catch (err) {
				assert.strictEqual(err.message, '[[error:topic-not-question]]');
			}
		});

		it('should throw error when topic does not exist', async () => {
			try {
				await topics.tools.solve(99999, ownerUid);
				assert.fail('Should have thrown an error');
			} catch (err) {
				assert.strictEqual(err.message, '[[error:no-topic]]');
			}
		});
	});

	describe('Idempotency', () => {
		it('should succeed silently when marking already-solved question as solved', async () => {
			await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);
			const result = await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);
			assert.strictEqual(result.solved, 1);
			assert.strictEqual(result.isSolved, true);
		});

		it('should succeed silently when marking already-unsolved question as unsolved', async () => {
			await topics.tools.unsolve(questionTopicData.topicData.tid, ownerUid);
			const result = await topics.tools.unsolve(questionTopicData.topicData.tid, ownerUid);
			assert.strictEqual(result.solved, 0);
			assert.strictEqual(result.isSolved, false);
		});
	});

	describe('API Endpoints', () => {
		it('should mark question as solved via API', async () => {
			await topics.tools.unsolve(questionTopicData.topicData.tid, ownerUid);
			await apiTopics.solve({ uid: ownerUid }, { tids: [questionTopicData.topicData.tid] });

			const topicData = await topics.getTopicData(questionTopicData.topicData.tid);
			assert.strictEqual(topicData.solved, 1);
		});

		it('should mark question as unsolved via API', async () => {
			await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);
			await apiTopics.unsolve({ uid: ownerUid }, { tids: [questionTopicData.topicData.tid] });

			const topicData = await topics.getTopicData(questionTopicData.topicData.tid);
			assert.strictEqual(topicData.solved, 0);
		});

		it('should handle multiple topics via API', async () => {
			const question2 = await topics.post({
				cid: categoryObj.cid,
				uid: ownerUid,
				title: 'Another Question',
				content: 'More questions',
				topicType: 'question',
			});

			await apiTopics.solve({ uid: ownerUid }, {
				tids: [questionTopicData.topicData.tid, question2.topicData.tid],
			});

			const topic1Data = await topics.getTopicData(questionTopicData.topicData.tid);
			const topic2Data = await topics.getTopicData(question2.topicData.tid);
			assert.strictEqual(topic1Data.solved, 1);
			assert.strictEqual(topic2Data.solved, 1);
		});

		it('should return error via API for non-privileged user', async () => {
			try {
				await apiTopics.solve({ uid: otherUserUid }, { tids: [questionTopicData.topicData.tid] });
				assert.fail('Should have thrown an error');
			} catch (err) {
				assert.strictEqual(err.message, '[[error:no-privileges]]');
			}
		});
	});

	describe('Event Logging', () => {
		it('should log solve event', async () => {
			await topics.tools.unsolve(questionTopicData.topicData.tid, ownerUid);
			const result = await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);

			assert(result.events);
			assert(Array.isArray(result.events));
			const solveEvent = result.events.find(e => e.type === 'solve');
			assert(solveEvent, 'Should have a solve event');
			assert.strictEqual(solveEvent.uid, ownerUid);
		});

		it('should log unsolve event', async () => {
			await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);
			const result = await topics.tools.unsolve(questionTopicData.topicData.tid, ownerUid);

			assert(result.events);
			assert(Array.isArray(result.events));
			const unsolveEvent = result.events.find(e => e.type === 'unsolve');
			assert(unsolveEvent, 'Should have an unsolve event');
			assert.strictEqual(unsolveEvent.uid, ownerUid);
		});

		it('should not log event when idempotent (already solved)', async () => {
			await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);
			const result = await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);

			assert(!result.events || result.events.length === 0, 'Should not log event for idempotent operation');
		});
	});

	describe('Integration with topicType', () => {
		it('should only allow solving topics with question topicType', async () => {
			// Regular note should fail
			try {
				await topics.tools.solve(regularTopicData.topicData.tid, ownerUid);
				assert.fail('Should have thrown an error');
			} catch (err) {
				assert.strictEqual(err.message, '[[error:topic-not-question]]');
			}

			// Question should succeed
			await topics.tools.unsolve(questionTopicData.topicData.tid, ownerUid);
			const result = await topics.tools.solve(questionTopicData.topicData.tid, ownerUid);
			assert.strictEqual(result.solved, 1);
		});

		it('should handle topics created without topicType (defaults to note)', async () => {
			const legacyTopic = await topics.post({
				cid: categoryObj.cid,
				uid: ownerUid,
				title: 'Legacy Topic',
				content: 'Created without topicType',
			});

			// Should fail because default topicType is 'note'
			try {
				await topics.tools.solve(legacyTopic.topicData.tid, ownerUid);
				assert.fail('Should have thrown an error');
			} catch (err) {
				assert.strictEqual(err.message, '[[error:topic-not-question]]');
			}
		});
	});
});
