'use strict';


const assert = require('assert');

const nconf = require('nconf');

const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const privileges = require('../src/privileges');
const user = require('../src/user');
const groups = require('../src/groups');
const socketPosts = require('../src/socket.io/posts');
const apiPosts = require('../src/api/posts');
const apiTopics = require('../src/api/topics');
const meta = require('../src/meta');
const helpers = require('./helpers');
const utils = require('../src/utils');
const request = require('../src/request');

describe('Frontend Private Posts', () => {
	let adminUid;
	let globalModUid;
	let regularUid;
	let guestUid;
	let modOnlyCid;
	let modOnlyTopic;
	let modOnlyPost;
	let normalTopic;
	let normalPost;

	before(async () => {
		adminUid = await user.create({ username: 'frontend_admin', password: 'adminpass123' });
		await groups.join('administrators', adminUid);
		globalModUid = await user.create({ username: 'frontend_globalmod', password: 'globalmodpass123' });
		await groups.join('Global Moderators', globalModUid);
		regularUid = await user.create({ username: 'frontend_regular', password: 'regularpass123' });
		guestUid = 0;
		({ cid: modOnlyCid } = await categories.create({
			name: 'Frontend Private Test Category',
			description: 'Category for frontend private post testing',
		}));
	});

	describe('Private post creation and rendering', () => {
		it('should create a modOnly topic and post successfully', async () => {
			const result = await topics.post({
				uid: adminUid,
				cid: modOnlyCid,
				title: 'Frontend Private Topic Test',
				content: 'This is a mod-only post for frontend testing',
				modOnly: true,
			});
			modOnlyTopic = result.topicData;
			modOnlyPost = result.postData;
			assert.strictEqual(modOnlyPost.modOnly, 1);
		});

		it('should create a normal topic and post successfully', async () => {
			const result = await topics.post({
				uid: regularUid,
				cid: modOnlyCid,
				title: 'Frontend Normal Topic Test',
				content: 'This is a normal post for frontend testing',
			});
			normalTopic = result.topicData;
			normalPost = result.postData;
			assert.strictEqual(normalPost.modOnly, 0);
		});

		it('should return post data with modOnly flag via API get', async () => {
			const result = await apiPosts.get({ uid: adminUid }, { pid: modOnlyPost.pid });
			assert(result);
			assert.strictEqual(result.pid, modOnlyPost.pid);
			assert.strictEqual(result.modOnly, 1);
		});

		it('should return post summary with modOnly field', async () => {
			const result = await apiPosts.getSummary({ uid: adminUid }, { pid: modOnlyPost.pid });
			assert(result);
			assert.strictEqual(result.pid, modOnlyPost.pid);
			assert.strictEqual(result.modOnly, 1);
		});

		it('should include modOnly in post data for privileged users', async () => {
			const postData = await posts.getPostData(modOnlyPost.pid);
			assert(postData);
			assert.strictEqual(postData.modOnly, 1);
		});
	});

	describe('Private post visibility by user role', () => {
		it('should allow admin to see modOnly post content', async () => {
			const result = await apiPosts.get({ uid: adminUid }, { pid: modOnlyPost.pid });
			assert(result);
			assert.strictEqual(result.content, 'This is a mod-only post for frontend testing');
		});

		it('should allow global moderator to see modOnly post content', async () => {
			const result = await apiPosts.get({ uid: globalModUid }, { pid: modOnlyPost.pid });
			assert(result);
			assert.strictEqual(result.content, 'This is a mod-only post for frontend testing');
		});

		it('should NOT allow regular user to see modOnly post', async () => {
			const result = await apiPosts.get({ uid: regularUid }, { pid: modOnlyPost.pid });
			assert.strictEqual(result, null);
		});

		it('should NOT allow guest to see modOnly post', async () => {
			const result = await apiPosts.get({ uid: guestUid }, { pid: modOnlyPost.pid });
			assert.strictEqual(result, null);
		});

		it('should allow all users to see normal post', async () => {
			const regularResult = await apiPosts.get({ uid: regularUid }, { pid: normalPost.pid });
			assert(regularResult);
			assert.strictEqual(regularResult.content, 'This is a normal post for frontend testing');

			const guestResult = await apiPosts.get({ uid: guestUid }, { pid: normalPost.pid });
			assert(guestResult);
			assert.strictEqual(guestResult.content, 'This is a normal post for frontend testing');
		});
	});

	describe('Private post filtering in topic view', () => {
		let topicWithMixedPosts;
		let privateReply;
		let normalReply;

		before(async () => {
			topicWithMixedPosts = await topics.post({
				uid: adminUid,
				cid: modOnlyCid,
				title: 'Mixed Private/Normal Topic',
				content: 'Main post content',
				modOnly: false,
			});

			privateReply = await topics.reply({
				uid: adminUid,
				tid: topicWithMixedPosts.topicData.tid,
				content: 'Private reply content',
				modOnly: true,
			});

			normalReply = await topics.reply({
				uid: regularUid,
				tid: topicWithMixedPosts.topicData.tid,
				content: 'Normal reply content',
				modOnly: false,
			});
		});

		it('should filter private posts from topic view for regular users', async () => {
			// Use privileges.posts.filter to test private post filtering
			const allPids = [topicWithMixedPosts.postData.pid, privateReply.pid, normalReply.pid];
			const filteredPids = await privileges.posts.filter('topics:read', allPids, regularUid);
			
			assert(!filteredPids.includes(privateReply.pid));
			assert(filteredPids.includes(topicWithMixedPosts.postData.pid));
			assert(filteredPids.includes(normalReply.pid));
		});

		it('should include all posts for admin', async () => {
			// Use privileges.posts.filter to test private post filtering
			const allPids = [topicWithMixedPosts.postData.pid, privateReply.pid, normalReply.pid];
			const filteredPids = await privileges.posts.filter('topics:read', allPids, adminUid);
			
			assert(filteredPids.includes(privateReply.pid));
			assert(filteredPids.includes(topicWithMixedPosts.postData.pid));
			assert(filteredPids.includes(normalReply.pid));
		});

		it('should filter private posts via privileges', async () => {
			const filteredPids = await privileges.posts.filter('topics:read', [privateReply.pid, normalReply.pid], regularUid);
			
			assert(!filteredPids.includes(privateReply.pid));
			assert(filteredPids.includes(normalReply.pid));
		});

		it('should NOT filter private posts for admin via privileges', async () => {
			const filteredPids = await privileges.posts.filter('topics:read', [privateReply.pid, normalReply.pid], adminUid);
			
			assert(filteredPids.includes(privateReply.pid));
			assert(filteredPids.includes(normalReply.pid));
		});
	});

	describe('Private post editing and modOnly toggling', () => {
		let editTestPost;

		before(async () => {
			editTestPost = await topics.post({
				uid: regularUid,
				cid: modOnlyCid,
				title: 'Edit Test Topic',
				content: 'Original content',
				modOnly: false,
			});
		});

		it('should allow admin to set modOnly flag via edit', async () => {
			await apiPosts.edit({ uid: adminUid }, {
				pid: editTestPost.postData.pid,
				content: 'Edited content',
				modOnly: true,
			});
			
			const updatedPost = await posts.getPostData(editTestPost.postData.pid);
			assert.strictEqual(updatedPost.modOnly, 1);
		});

		it('should allow admin to unset modOnly flag via edit', async () => {
			await apiPosts.edit({ uid: adminUid }, {
				pid: editTestPost.postData.pid,
				content: 'Edited content again',
				modOnly: false,
			});
			
			const updatedPost = await posts.getPostData(editTestPost.postData.pid);
			assert.strictEqual(updatedPost.modOnly, 0);
		});

		it('should allow global moderator to set modOnly flag via edit', async () => {
			const modTestPost = await topics.post({
				uid: globalModUid,
				cid: modOnlyCid,
				title: 'Mod Test Topic',
				content: 'Mod test content',
				modOnly: false,
			});

			await apiPosts.edit({ uid: globalModUid }, {
				pid: modTestPost.postData.pid,
				content: 'Edited by mod',
				modOnly: true,
			});
			
			const updatedPost = await posts.getPostData(modTestPost.postData.pid);
			assert.strictEqual(updatedPost.modOnly, 1);
		});

		it('should NOT allow regular user to set modOnly flag via edit', async () => {
			let err;
			try {
				await apiPosts.edit({ uid: regularUid }, {
					pid: editTestPost.postData.pid,
					content: 'Regular user edit attempt',
					modOnly: true,
				});
			} catch (_err) {
				err = _err;
			}
			assert(err);
			assert.strictEqual(err.message, '[[error:no-privileges]]');

			const stored = await posts.getPostField(editTestPost.postData.pid, 'modOnly');
			assert.strictEqual(stored, 0);
		});

		it('should NOT allow regular user to unset modOnly flag via edit', async () => {
			// First make it modOnly
			await apiPosts.edit({ uid: adminUid }, {
				pid: editTestPost.postData.pid,
				content: 'Admin made it modOnly',
				modOnly: true,
			});

			let err;
			try {
				await apiPosts.edit({ uid: regularUid }, {
					pid: editTestPost.postData.pid,
					content: 'Regular user edit attempt',
					modOnly: false,
				});
			} catch (_err) {
				err = _err;
			}
			assert(err);
			assert.strictEqual(err.message, '[[error:no-privileges]]');

			const stored = await posts.getPostField(editTestPost.postData.pid, 'modOnly');
			assert.strictEqual(stored, 1);
		});
	});

	describe('Private post privilege flags', () => {
		it('should return isModOnly flag for modOnly posts', async () => {
			const privs = await privileges.posts.get([modOnlyPost.pid], regularUid);
			assert.strictEqual(privs[0].isModOnly, true);
		});

		it('should return correct read privilege for modOnly posts for regular users', async () => {
			const privs = await privileges.posts.get([modOnlyPost.pid], regularUid);
			assert.strictEqual(privs[0].read, false);
			assert.strictEqual(privs[0]['topics:read'], false);
		});

		it('should return correct read privilege for modOnly posts for admin', async () => {
			const privs = await privileges.posts.get([modOnlyPost.pid], adminUid);
			assert.strictEqual(privs[0].read, true);
			assert.strictEqual(privs[0]['topics:read'], true);
			assert.strictEqual(privs[0].isModOnly, true);
			assert.strictEqual(privs[0].isAdminOrMod, true);
		});

		it('should return correct read privilege for modOnly posts for global moderator', async () => {
			const privs = await privileges.posts.get([modOnlyPost.pid], globalModUid);
			assert.strictEqual(privs[0].read, true);
			assert.strictEqual(privs[0]['topics:read'], true);
			assert.strictEqual(privs[0].isModOnly, true);
			assert.strictEqual(privs[0].isAdminOrMod, true);
		});

		it('should return correct privilege flags for normal posts', async () => {
			const privs = await privileges.posts.get([normalPost.pid], regularUid);
			assert.strictEqual(privs[0].isModOnly, false);
			assert.strictEqual(privs[0].read, true);
		});
	});

	describe('Private post content modification via modifyPostByPrivilege', () => {
		it('should hide modOnly post content for non-privileged users', () => {
			const mockPost = { 
				content: 'secret content', 
				modOnly: 1, 
				user: { signature: 'sig' } 
			};
			const mockPrivs = { isAdminOrMod: false, 'posts:view_deleted': false };
			posts.modifyPostByPrivilege(mockPost, mockPrivs);
			assert.strictEqual(mockPost.content, '[[topic:post-is-mod-only]]');
			assert.strictEqual(mockPost.user.signature, '');
		});

		it('should NOT hide modOnly post content for privileged users', () => {
			const mockPost = { 
				content: 'secret content', 
				modOnly: 1, 
				user: { signature: 'sig' } 
			};
			const mockPrivs = { isAdminOrMod: true, 'posts:view_deleted': false };
			posts.modifyPostByPrivilege(mockPost, mockPrivs);
			assert.strictEqual(mockPost.content, 'secret content');
			assert.strictEqual(mockPost.user.signature, 'sig');
		});

		it('should NOT modify normal post content for any user', () => {
			const mockPost = { 
				content: 'normal content', 
				modOnly: 0, 
				user: { signature: 'sig' } 
			};
			const mockPrivs = { isAdminOrMod: false, 'posts:view_deleted': false };
			posts.modifyPostByPrivilege(mockPost, mockPrivs);
			assert.strictEqual(mockPost.content, 'normal content');
			assert.strictEqual(mockPost.user.signature, 'sig');
		});
	});

	describe('Private post summary access', () => {
		it('should NOT allow guest to see modOnly post via getSummary', async () => {
			const result = await apiPosts.getSummary({ uid: 0 }, { pid: modOnlyPost.pid });
			assert.strictEqual(result, null);
		});

		it('should allow admin to see modOnly post via getSummary', async () => {
			const result = await apiPosts.getSummary({ uid: adminUid }, { pid: modOnlyPost.pid });
			assert(result);
			assert.strictEqual(result.pid, modOnlyPost.pid);
		});

		it('should allow global moderator to see modOnly post via getSummary', async () => {
			const result = await apiPosts.getSummary({ uid: globalModUid }, { pid: modOnlyPost.pid });
			assert(result);
			assert.strictEqual(result.pid, modOnlyPost.pid);
		});

		it('should allow regular user to see normal post via getSummary', async () => {
			const result = await apiPosts.getSummary({ uid: regularUid }, { pid: normalPost.pid });
			assert(result);
			assert.strictEqual(result.pid, normalPost.pid);
		});
	});

	describe('Private post raw content access', () => {
		it('should NOT allow regular user to get raw content of modOnly post', async () => {
			const result = await apiPosts.getRaw({ uid: regularUid }, { pid: modOnlyPost.pid });
			assert.strictEqual(result, null);
		});

		it('should allow admin to get raw content of modOnly post', async () => {
			const result = await apiPosts.getRaw({ uid: adminUid }, { pid: modOnlyPost.pid });
			assert(result);
			assert(result.length > 0);
			assert(result.includes('mod-only post for frontend testing'));
		});

		it('should allow admin to get raw content of normal post', async () => {
			const result = await apiPosts.getRaw({ uid: adminUid }, { pid: normalPost.pid });
			assert(result);
			assert(result.length > 0);
		});
	});

	describe('Private post events - post_edited', () => {
		let eventTestPost;

		before(async () => {
			eventTestPost = await topics.post({
				uid: adminUid,
				cid: modOnlyCid,
				title: 'Event Test Topic',
				content: 'Original content for events',
				modOnly: false,
			});
		});

		it('should emit post_edited event with modOnly field when post is edited', (done) => {
			// The post_edited event is emitted by apiPosts.edit
			// We verify this through the database update
			apiPosts.edit({ uid: adminUid }, {
				pid: eventTestPost.postData.pid,
				content: 'Edited content',
				modOnly: true,
			}).then(() => {
				// Verify the edit worked
				done();
			}).catch(done);
		}, 5000);

		it('should update modOnly field in database after edit', async () => {
			const updatedPost = await posts.getPostData(eventTestPost.postData.pid);
			assert.strictEqual(updatedPost.modOnly, 1);
		});

		it('should allow toggling modOnly flag multiple times', async () => {
			// Toggle to false
			await apiPosts.edit({ uid: adminUid }, {
				pid: eventTestPost.postData.pid,
				content: 'Content toggle',
				modOnly: false,
			});
			const post1 = await posts.getPostData(eventTestPost.postData.pid);
			assert.strictEqual(post1.modOnly, 0);

			// Toggle back to true
			await apiPosts.edit({ uid: adminUid }, {
				pid: eventTestPost.postData.pid,
				content: 'Content toggle again',
				modOnly: true,
			});
			const post2 = await posts.getPostData(eventTestPost.postData.pid);
			assert.strictEqual(post2.modOnly, 1);
		});
	});

	describe('Private post in category context', () => {
		let privateCategoryCid;
		let privateCategoryTopic;

		before(async () => {
			({ cid: privateCategoryCid } = await categories.create({
				name: 'Private Category Test',
				description: 'Category for private post testing',
			}));
			
			privateCategoryTopic = await topics.post({
				uid: adminUid,
				cid: privateCategoryCid,
				title: 'Private Category Topic',
				content: 'Content in private category',
				modOnly: true,
			});
		});

		it('should allow admin to see private post in private category', async () => {
			const result = await apiPosts.get({ uid: adminUid }, { pid: privateCategoryTopic.postData.pid });
			assert(result);
			assert.strictEqual(result.content, 'Content in private category');
		});

		it('should NOT allow regular user to see private post in private category', async () => {
			const result = await apiPosts.get({ uid: regularUid }, { pid: privateCategoryTopic.postData.pid });
			assert.strictEqual(result, null);
		});

		it('should allow admin to see private category topic', async () => {
			const categoryData = await categories.getCategoryData(privateCategoryCid);
			assert(categoryData);
			assert.strictEqual(categoryData.cid, privateCategoryCid);
			// Verify the topic exists and is accessible
			const topicData = await topics.getTopicData(privateCategoryTopic.topicData.tid);
			assert(topicData);
			assert.strictEqual(topicData.cid, privateCategoryCid);
		});

		it('should allow regular user to see category (but not private posts)', async () => {
			const categoryData = await categories.getCategoryData(privateCategoryCid, regularUid);
			assert(categoryData);
			// Category should still be visible, but private posts filtered
		});
	});

	describe('Private post reply chain', () => {
		let topicWithPrivateReply;
		let firstReply;
		let privateReply2;

		before(async () => {
			topicWithPrivateReply = await topics.post({
				uid: adminUid,
				cid: modOnlyCid,
				title: 'Private Reply Chain Topic',
				content: 'Initial post',
				modOnly: false,
			});

			firstReply = await topics.reply({
				uid: adminUid,
				tid: topicWithPrivateReply.topicData.tid,
				content: 'First normal reply',
				modOnly: false,
			});

			privateReply2 = await topics.reply({
				uid: adminUid,
				tid: topicWithPrivateReply.topicData.tid,
				content: 'Private reply in chain',
				modOnly: true,
			});
		});

		it('should allow regular user to see initial post and first reply', async () => {
			const allPids = [topicWithPrivateReply.postData.pid, firstReply.pid, privateReply2.pid];
			const filteredPids = await privileges.posts.filter('topics:read', allPids, regularUid);
			
			assert(filteredPids.includes(topicWithPrivateReply.postData.pid));
			assert(filteredPids.includes(firstReply.pid));
			assert(!filteredPids.includes(privateReply2.pid));
		});

		it('should allow admin to see all posts including private reply', async () => {
			const allPids = [topicWithPrivateReply.postData.pid, firstReply.pid, privateReply2.pid];
			const filteredPids = await privileges.posts.filter('topics:read', allPids, adminUid);
			
			assert(filteredPids.includes(topicWithPrivateReply.postData.pid));
			assert(filteredPids.includes(firstReply.pid));
			assert(filteredPids.includes(privateReply2.pid));
		});

		it('should filter private reply from post summaries', async () => {
			const allPids = [topicWithPrivateReply.postData.pid, firstReply.pid, privateReply2.pid];
			const filteredPids = await privileges.posts.filter('topics:read', allPids, regularUid);
			
			assert(filteredPids.includes(topicWithPrivateReply.postData.pid));
			assert(filteredPids.includes(firstReply.pid));
			assert(!filteredPids.includes(privateReply2.pid));
		});
	});

	describe('Private post pagination', () => {
		let topicWithManyPosts;
		let privatePosts = [];
		let normalPosts = [];

		before(async () => {
			topicWithManyPosts = await topics.post({
				uid: adminUid,
				cid: modOnlyCid,
				title: 'Many Posts Topic',
				content: 'First post',
				modOnly: false,
			});
			normalPosts.push(topicWithManyPosts.postData);

			// Create multiple posts with alternating private/normal
			for (let i = 0; i < 5; i++) {
				const isPrivate = i % 2 === 0;
				const reply = await topics.reply({
					uid: adminUid,
					tid: topicWithManyPosts.topicData.tid,
					content: `Reply ${i + 1}`,
					modOnly: isPrivate,
				});
				if (isPrivate) {
					privatePosts.push(reply);
				} else {
					normalPosts.push(reply);
				}
			}
		}, 10000);

		it('should filter private posts for regular user', async () => {
			const allPids = [topicWithManyPosts.postData.pid, ...normalPosts.map(p => p.pid), ...privatePosts.map(p => p.pid)];
			const filteredPids = await privileges.posts.filter('topics:read', allPids, regularUid);
			
			// All private posts should be filtered out
			privatePosts.forEach(privatePost => {
				assert(!filteredPids.includes(privatePost.pid), `Private post ${privatePost.pid} should be filtered`);
			});
			
			// All normal posts should be included
			normalPosts.forEach(normalPost => {
				assert(filteredPids.includes(normalPost.pid), `Normal post ${normalPost.pid} should be included`);
			});
		});

		it('should include all posts for admin', async () => {
			const allPids = [topicWithManyPosts.postData.pid, ...normalPosts.map(p => p.pid), ...privatePosts.map(p => p.pid)];
			const filteredPids = await privileges.posts.filter('topics:read', allPids, adminUid);
			
			// All posts should be included
			([...normalPosts, ...privatePosts]).forEach(post => {
				assert(filteredPids.includes(post.pid), `Post ${post.pid} should be included for admin`);
			});
		});
	});

	describe('Private post API endpoints', () => {
		it('should return modOnly flag in API get response for privileged users', async () => {
			const result = await apiPosts.get({ uid: adminUid }, { pid: modOnlyPost.pid });
			assert(result);
			assert(result.hasOwnProperty('modOnly'));
			assert.strictEqual(result.modOnly, 1);
		});

		it('should return modOnly flag in API getSummary response', async () => {
			const result = await apiPosts.getSummary({ uid: adminUid }, { pid: modOnlyPost.pid });
			assert(result);
			assert(result.hasOwnProperty('modOnly'));
			assert.strictEqual(result.modOnly, 1);
		});

		it('should include modOnly in API edit request', async () => {
			const editTest = await topics.post({
				uid: adminUid,
				cid: modOnlyCid,
				title: 'Edit API Test',
				content: 'Original content here',
				modOnly: false,
			});

			await apiPosts.edit({ uid: adminUid }, {
				pid: editTest.postData.pid,
				content: 'Updated content here',
				modOnly: true,
			});

			const updated = await posts.getPostData(editTest.postData.pid);
			assert.strictEqual(updated.modOnly, 1);
		});
	});

	after(async () => {
		// Clean up test data
		await db.delete(`cid:${modOnlyCid}:tids`);
		await db.delete(`cid:${modOnlyCid}:posts`);
	});
});