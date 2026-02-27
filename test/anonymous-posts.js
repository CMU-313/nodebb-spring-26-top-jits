'use strict';

/**
 * Tests for the anonymous posts FRONTEND feature.
 *
 * Scope: This file tests frontend-facing behavior:
 *   1. The API correctly accepts the `anonymous` flag in request payloads
 *      without errors (i.e., the UI can send it).
 *   2. Author identity (uid) is always preserved in posts regardless of the
 *      anonymous flag — prerequisite for the display layer to correctly
 *      distinguish author vs. non-author viewers.
 *   3. The anonymous field roundtrips correctly through API responses.
 *   4. selfPost and isAdminOrMod privileges are set correctly for
 *      controlling anonymous post display behavior.
 */

const assert = require('assert');

const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const user = require('../src/user');
const groups = require('../src/groups');
const helpers = require('./helpers');

describe('Anonymous Posts Frontend', () => {
	let adminUid;
	let regularUid;
	let cid;
	let topicData;

	before(async () => {
		adminUid = await user.create({
			username: 'anon_admin',
			password: 'adminpass',
		});
		await groups.join('administrators', adminUid);

		regularUid = await user.create({
			username: 'anon_regular',
			password: 'regularpass',
		});

		({ cid } = await categories.create({
			name: 'Anonymous Test Category',
			description: 'Category for anonymous post tests',
		}));

		({ topicData } = await topics.post({
			uid: regularUid,
			cid,
			title: 'Anonymous Test Topic',
			content: 'Content of anonymous test topic',
		}));
	});

	describe('HTTP API accepts anonymous flag in topic creation', () => {
		let regularJar;

		before(async () => {
			({ jar: regularJar } = await helpers.loginUser(
				'anon_regular',
				'regularpass',
			));
		});

		it('should accept anonymous: true when creating a topic via HTTP without error', async () => {
			const result = await helpers.request('post', `/api/v3/topics`, {
				body: {
					title: 'HTTP anonymous topic',
					cid,
					content: 'Content for HTTP anonymous topic',
					anonymous: true,
				},
				jar: regularJar,
				json: true,
			});

			assert.strictEqual(
				result.body.status.code,
				'ok',
				`Expected ok status, got: ${result.body.status.message}`,
			);
			assert(result.body.response.tid, 'Response should have a tid');
		});

		it('should accept anonymous: false when creating a topic via HTTP without error', async () => {
			const result = await helpers.request('post', `/api/v3/topics`, {
				body: {
					title: 'HTTP non-anonymous topic',
					cid,
					content: 'Content for HTTP non-anonymous topic',
					anonymous: false,
				},
				jar: regularJar,
				json: true,
			});

			assert.strictEqual(
				result.body.status.code,
				'ok',
				`Expected ok status, got: ${result.body.status.message}`,
			);
			assert(result.body.response.tid, 'Response should have a tid');
		});
	});

	describe('HTTP API accepts anonymous flag in replies', () => {
		let regularJar;

		before(async () => {
			({ jar: regularJar } = await helpers.loginUser(
				'anon_regular',
				'regularpass',
			));
		});

		it('should accept anonymous: true when posting a reply via HTTP without error', async () => {
			const result = await helpers.request(
				'post',
				`/api/v3/topics/${topicData.tid}`,
				{
					body: {
						content: 'HTTP anonymous reply',
						anonymous: true,
					},
					jar: regularJar,
					json: true,
				},
			);

			assert.strictEqual(
				result.body.status.code,
				'ok',
				`Expected ok status, got: ${result.body.status.message}`,
			);
			assert(result.body.response.pid, 'Response should have a pid');
		});

		it('should accept anonymous: false when posting a reply via HTTP without error', async () => {
			const result = await helpers.request(
				'post',
				`/api/v3/topics/${topicData.tid}`,
				{
					body: {
						content: 'HTTP non-anonymous reply',
						anonymous: false,
					},
					jar: regularJar,
					json: true,
				},
			);

			assert.strictEqual(
				result.body.status.code,
				'ok',
				`Expected ok status, got: ${result.body.status.message}`,
			);
			assert(result.body.response.pid, 'Response should have a pid');
		});
	});

	describe('Author identity is always preserved in posts', () => {
		it('should always store the real author uid when a post is created', async () => {
			const result = await topics.post({
				uid: regularUid,
				cid,
				title: 'Author uid preservation test',
				content: 'Verifying uid is always stored',
			});

			assert(result);
			const storedUid = await posts.getPostField(result.postData.pid, 'uid');
			assert.strictEqual(
				parseInt(storedUid, 10),
				regularUid,
				'Author uid must always be stored correctly in the post',
			);
		});

		it('should always store the real author uid when a reply is created', async () => {
			const reply = await topics.reply({
				uid: regularUid,
				tid: topicData.tid,
				content: 'Author uid preservation in reply',
			});

			assert(reply);
			const storedUid = await posts.getPostField(reply.pid, 'uid');
			assert.strictEqual(
				parseInt(storedUid, 10),
				regularUid,
				'Author uid must always be stored correctly in a reply',
			);
		});

		it('posts.isOwner should identify the real author of a post', async () => {
			const result = await topics.post({
				uid: regularUid,
				cid,
				title: 'isOwner test post',
				content: 'Content for isOwner test',
			});

			const isOwner = await posts.isOwner(result.postData.pid, regularUid);
			assert.strictEqual(isOwner, true, 'Author should be identified as owner');
		});

		it('posts.isOwner should not identify a non-author as the post owner', async () => {
			const result = await topics.post({
				uid: regularUid,
				cid,
				title: 'isOwner non-author test',
				content: 'Content for non-author isOwner test',
			});

			const isOwner = await posts.isOwner(result.postData.pid, adminUid);
			assert.strictEqual(
				isOwner,
				false,
				'Admin (non-author) should not be identified as post owner',
			);
		});
	});

	describe('Admin privileges.isAdminOrMod is set for admin users', () => {
		let adminJar;
		let regularJar;

		before(async () => {
			({ jar: adminJar } = await helpers.loginUser('anon_admin', 'adminpass'));
			({ jar: regularJar } = await helpers.loginUser(
				'anon_regular',
				'regularpass',
			));
		});

		it('admin user should have isAdminOrMod in topic page privileges', async () => {
			const result = await topics.post({
				uid: regularUid,
				cid,
				title: 'Privilege check topic',
				content: 'Content for privilege check',
			});
			const topicSlug = result.topicData.slug;

			const { body } = await helpers.request('get', `/api/topic/${topicSlug}`, {
				jar: adminJar,
				json: true,
			});

			assert(body.privileges, 'Topic API response should include privileges');
			assert.strictEqual(
				body.privileges.isAdminOrMod,
				true,
				'Admin should have isAdminOrMod: true in topic privileges',
			);
		});

		it('regular user should NOT have isAdminOrMod in topic page privileges', async () => {
			const result = await topics.post({
				uid: regularUid,
				cid,
				title: 'Regular user privilege check',
				content: 'Content for regular privilege check',
			});
			const topicSlug = result.topicData.slug;

			const { body } = await helpers.request('get', `/api/topic/${topicSlug}`, {
				jar: regularJar,
				json: true,
			});

			assert(body.privileges, 'Topic API response should include privileges');
			assert.strictEqual(
				body.privileges.isAdminOrMod,
				false,
				'Regular user should have isAdminOrMod: false in topic privileges',
			);
		});
	});

	describe('Anonymous field roundtrip through API', () => {
		let regularJar;

		before(async () => {
			({ jar: regularJar } = await helpers.loginUser(
				'anon_regular',
				'regularpass',
			));
		});

		it('should return anonymous: true in topic creation response', async () => {
			const result = await helpers.request('post', `/api/v3/topics`, {
				body: {
					title: 'Roundtrip anonymous topic',
					cid,
					content: 'Content for roundtrip anonymous topic',
					anonymous: true,
				},
				jar: regularJar,
				json: true,
			});

			assert.strictEqual(result.body.status.code, 'ok');
			assert.strictEqual(
				result.body.response.anonymous,
				true,
				'Anonymous field should be true in topic creation response',
			);
		});

		it('should return anonymous: true in reply creation response', async () => {
			const result = await helpers.request(
				'post',
				`/api/v3/topics/${topicData.tid}`,
				{
					body: {
						content: 'Roundtrip anonymous reply',
						anonymous: true,
					},
					jar: regularJar,
					json: true,
				},
			);

			assert.strictEqual(result.body.status.code, 'ok');
			assert.strictEqual(
				result.body.response.anonymous,
				true,
				'Anonymous field should be true in reply creation response',
			);
		});
	});

	describe('Anonymous field defaults to false', () => {
		it('should default anonymous to false when not specified in topic creation', async () => {
			const result = await topics.post({
				uid: regularUid,
				cid,
				title: 'Default anonymous test',
				content: 'Content without anonymous flag',
			});

			assert(result);
			const postAnonymous = await posts.getPostField(
				result.postData.pid,
				'anonymous',
			);
			assert(
				!postAnonymous || postAnonymous === false || postAnonymous === 'false',
				`Anonymous should default to false, got: ${postAnonymous}`,
			);
		});

		it('should default anonymous to false when not specified in reply', async () => {
			const reply = await topics.reply({
				uid: regularUid,
				tid: topicData.tid,
				content: 'Reply without anonymous flag',
			});

			assert(reply);
			const replyAnonymous = await posts.getPostField(reply.pid, 'anonymous');
			assert(
				!replyAnonymous ||
					replyAnonymous === false ||
					replyAnonymous === 'false',
				`Anonymous should default to false in reply, got: ${replyAnonymous}`,
			);
		});
	});

	describe('Topic page API includes anonymous field on posts', () => {
		let adminJar;
		let regularJar;
		let anonTopicSlug;
		let anonTopicTid;

		before(async () => {
			({ jar: adminJar } = await helpers.loginUser('anon_admin', 'adminpass'));
			({ jar: regularJar } = await helpers.loginUser(
				'anon_regular',
				'regularpass',
			));

			const result = await topics.post({
				uid: regularUid,
				cid,
				title: 'Display test anonymous topic',
				content: 'Content for display test',
				anonymous: true,
			});
			anonTopicSlug = result.topicData.slug;
			anonTopicTid = result.topicData.tid;
		});

		it('should include anonymous field on posts when fetching topic page', async () => {
			const { body } = await helpers.request(
				'get',
				`/api/topic/${anonTopicSlug}`,
				{
					jar: adminJar,
					json: true,
				},
			);

			assert(body.posts, 'Topic API response should include posts');
			assert(body.posts.length > 0, 'Should have at least one post');
			const mainPost = body.posts[0];
			assert.strictEqual(
				mainPost.anonymous,
				true,
				'Main post should have anonymous: true',
			);
		});

		it('admin should see selfPost as false for other user\'s anonymous post', async () => {
			const { body } = await helpers.request(
				'get',
				`/api/topic/${anonTopicSlug}`,
				{
					jar: adminJar,
					json: true,
				},
			);

			const mainPost = body.posts[0];
			assert.strictEqual(
				mainPost.selfPost,
				false,
				'Admin viewing another user\'s post should have selfPost: false',
			);
		});

		it('author should see selfPost as true for their own anonymous post', async () => {
			const { body } = await helpers.request(
				'get',
				`/api/topic/${anonTopicSlug}`,
				{
					jar: regularJar,
					json: true,
				},
			);

			const mainPost = body.posts[0];
			assert.strictEqual(
				mainPost.selfPost,
				true,
				'Author viewing their own anonymous post should have selfPost: true',
			);
		});

		it('anonymous reply should also have anonymous field in topic page', async () => {
			await topics.reply({
				uid: regularUid,
				tid: anonTopicTid,
				content: 'Anonymous reply for display test',
				anonymous: true,
			});

			const { body } = await helpers.request(
				'get',
				`/api/topic/${anonTopicSlug}`,
				{
					jar: regularJar,
					json: true,
				},
			);

			const replyPost = body.posts.find(
				(p) =>
					p.content && p.content.includes('Anonymous reply for display test'),
			);
			assert(replyPost, 'Should find the anonymous reply');
			assert.strictEqual(
				replyPost.anonymous,
				true,
				'Anonymous reply should have anonymous: true in topic page',
			);
		});
	});
});
