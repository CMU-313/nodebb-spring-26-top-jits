'use strict';

const db = require('../database');
const plugins = require('../plugins');
const utils = require('../utils');
const Posts = require('./index');
const translate = require('../translate');

const intFields = [
	'uid', 'pid', 'tid', 'deleted', 'timestamp',
	'upvotes', 'downvotes', 'deleterUid', 'edited',
	'replies', 'bookmarks', 'announces', 'modOnly',
];

// Global translation retry queue with limited concurrency to avoid server overload
// Attached to global scope so all module instances share the same queue
if (!global.translationRetryQueue) {
	global.translationRetryQueue = {
		queue: [],
		processing: false,
		concurrency: 1, // Process one translation at a time
		async process() {
			if (this.processing || this.queue.length === 0) {
				return;
			}
			this.processing = true;
			try {
				while (this.queue.length > 0 && this.processing) {
					const post = this.queue.shift();
					try {
						const [isEnglish, translatedContent, translationStatus] = await translate.retryTranslation({ content: post.content });
						if (translationStatus) {
							await db.updateObject(`post:${post.pid}`, {
								isEnglish,
								translatedContent,
								translationStatus: true,
							});
						}
					} catch (e) {
						// Keep translationStatus as false if retry fails
					}
				}
			} finally {
				this.processing = false;
			}
		},
		add(post) {
			this.queue.push(post);
			this.process();
		},
	};
}

module.exports = function (Posts) {
	Posts.getPostsFields = async function (pids, fields) {
		if (!Array.isArray(pids) || !pids.length) {
			return [];
		}
		const keys = pids.map(pid => `post:${pid}`);
		const postData = await db.getObjects(keys, fields);
		const result = await plugins.hooks.fire('filter:post.getFields', {
			pids: pids,
			posts: postData,
			fields: fields,
		});
		result.posts.forEach(post => modifyPost(post, fields));
		retryFailedTranslations(result.posts);
		return result.posts;
	};

	Posts.getPostData = async function (pid) {
		const posts = await Posts.getPostsFields([pid], []);
		return posts && posts.length ? posts[0] : null;
	};

	Posts.getPostsData = async function (pids) {
		return await Posts.getPostsFields(pids, []);
	};

	Posts.getPostField = async function (pid, field) {
		const post = await Posts.getPostFields(pid, [field]);
		return post && post.hasOwnProperty(field) ? post[field] : null;
	};

	Posts.getPostFields = async function (pid, fields) {
		const posts = await Posts.getPostsFields([pid], fields);
		return posts ? posts[0] : null;
	};

	Posts.setPostField = async function (pid, field, value) {
		await Posts.setPostFields(pid, { [field]: value });
	};

	Posts.setPostFields = async function (pid, data) {
		await db.setObject(`post:${pid}`, data);
		plugins.hooks.fire('action:post.setFields', { data: { ...data, pid } });
	};
};

function retryFailedTranslations(posts) {
	const failedPosts = posts.filter(post => post && post.translationStatus === false);
	if (failedPosts.length === 0) {
		return;
	}

	// Queue translation retries for sequential processing
	failedPosts.forEach(post => global.translationRetryQueue.add(post));
}

function modifyPost(post, fields) {
	if (post) {
		db.parseIntFields(post, intFields, fields);
		if (post.hasOwnProperty('upvotes') && post.hasOwnProperty('downvotes')) {
			post.votes = post.upvotes - post.downvotes;
		}
		if (post.hasOwnProperty('timestamp')) {
			post.timestampISO = utils.toISOString(post.timestamp);
		}
		if (post.hasOwnProperty('edited')) {
			post.editedISO = post.edited !== 0 ? utils.toISOString(post.edited) : '';
		}
		if (!fields.length || fields.includes('attachments')) {
			post.attachments = (post.attachments || '').split(',').filter(Boolean);
		}

		if (!fields.length || fields.includes('uploads')) {
			try {
				post.uploads = post.uploads ? JSON.parse(post.uploads) : [];
			} catch (err) {
				post.uploads = [];
			}
		}

		// Mark post as "English" if decided by translator service or if it has no info
		post.isEnglish = post.isEnglish == 'true' || post.isEnglish === undefined;
		// If translatedContent is undefined, default to empty string (no translation needed for English posts)
		if (post.translatedContent === undefined) {
			post.translatedContent = '';
		}

		if (typeof post.postType === 'undefined' || post.postType === null) {
			post.postType = Posts.DEFAULT_POST_TYPE;
		}

		if (post.hasOwnProperty('anonymous')) {
			post.anonymous = post.anonymous === true || post.anonymous === 1 || post.anonymous === '1' || post.anonymous === 'true';
		} else {
			post.anonymous = false;
		}
		if (typeof post.modOnly === 'undefined' || post.modOnly === null) {
			post.modOnly = 0;
		}
	}
}
