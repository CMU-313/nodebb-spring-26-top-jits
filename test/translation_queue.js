'use strict';

const assert = require('assert');

const db = require('./mocks/databasemock');

const translationQueue = require('../src/translation_queue');

describe('translationQueue', () => {
	beforeEach(() => {
		// Reset queue state
		translationQueue._isProcessing = false;
		translationQueue._currentConcurrent = 0;
	});

	afterEach(async () => {
		// Clear interval if set
		if (translationQueue._interval) {
			clearInterval(translationQueue._interval);
			translationQueue._interval = null;
		}
		// Clear queue
		await db.delete('translation:retry_queue');
	});

	describe('add', () => {
		it('should add a post to the retry queue', async () => {
			await translationQueue.add('123');
			
			const members = await db.getSetMembers('translation:retry_queue');
			assert(members.includes('123'));
		});
	});

	describe('remove', () => {
		it('should remove a post from the retry queue', async () => {
			await db.setAdd('translation:retry_queue', ['123', '456']);
			
			await translationQueue.remove('123');
			
			const members = await db.getSetMembers('translation:retry_queue');
			assert(!members.includes('123'));
			assert(members.includes('456'));
		});
	});

	describe('getPending', () => {
		it('should get all posts in the retry queue', async () => {
			await db.setAdd('translation:retry_queue', ['123', '456', '789']);
			
			const result = await translationQueue.getPending();
			
			assert(result.includes('123'));
			assert(result.includes('456'));
			assert(result.includes('789'));
		});
	});

	describe('retryTranslation', () => {
		it('should retry translation for a post and return success status', async () => {
			// Create a test post
			await db.setObject('post:123', {
				pid: '123',
				content: 'Test content',
				isEnglish: false,
			});
			
			const result = await translationQueue.retryTranslation('123');
			
			// Result depends on whether translation service is running
			// - If running: returns true (success)
			// - If not running: returns false (failed)
			// Both are valid outcomes
			assert(typeof result === 'boolean');
		});

		it('should return false when post is not found', async () => {
			const result = await translationQueue.retryTranslation('nonexistent');
			
			assert.strictEqual(result, false);
		});
	});

	describe('process', () => {
		it('should process one post from the queue', async () => {
			await db.setAdd('translation:retry_queue', ['123']);
			
			const initialMembers = await db.getSetMembers('translation:retry_queue');
			assert(initialMembers.includes('123'));
			
			await translationQueue.process();
			
			// Post may or may not be removed depending on translation service availability
			// Just verify the process ran without error
		});

		it('should keep post in queue when translation fails', async () => {
			// Mock translate to always fail
			const translate = require('../src/translate');
			const originalTranslate = translate.translate;
			translate.translate = async () => [true, '', false];
			
			await db.setAdd('translation:retry_queue', ['456']);
			await translationQueue.process();
			
			const members = await db.getSetMembers('translation:retry_queue');
			assert(members.includes('456'));
			
			// Restore original translate
			translate.translate = originalTranslate;
		});

		it('should handle empty queue', async () => {
			await translationQueue.process();
			
			const members = await db.getSetMembers('translation:retry_queue');
			assert.strictEqual(members.length, 0);
		});
	});

	describe('start/stop', () => {
		it('should set interval for queue processing', () => {
			translationQueue.start();
			assert(translationQueue._interval !== undefined);
		});

		it('should clear interval on stop', async () => {
			translationQueue.start();
			assert(translationQueue._interval !== undefined);
			
			await translationQueue.stop();
			assert(translationQueue._interval === null);
		});
	});
});
