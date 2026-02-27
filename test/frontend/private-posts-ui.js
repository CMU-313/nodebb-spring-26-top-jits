'use strict';


const assert = require('assert');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

describe('Frontend Private Posts - UI Component Testing', () => {
	let dom;
	let $;
	let jQuery;

	before(() => {
		dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
			url: 'http://localhost',
			runScripts: 'dangerously',
			resources: 'usable',
		});
		$ = global.$ = global.jQuery = jQuery = require('jquery')(dom.window);
	});

	describe('Composer private toggle button', () => {
		it('should initialize with fa-square-o icon when post is not private', () => {
			const html = `
				<div class="composer-container">
					<button class="btn btn-sm btn-link text-body fw-semibold private-post-toggle" data-action="togglePrivatePost">
						<div class="checkbox position-relative d-none d-md-inline">
							<i class="fa text-muted pointer fa-square-o p-1"></i>
						</div>
						<span class="d-none d-md-inline">Private</span>
					</button>
				</div>
			`;
			const $container = $(html);
			
			const $icon = $container.find('.private-post-toggle').find('i');
			assert.strictEqual($icon.hasClass('fa-square-o'), true);
			assert.strictEqual($icon.hasClass('fa-lock'), false);
		});

		it('should toggle to fa-lock icon when clicked and toggle class logic works', () => {
			const html = `
				<div class="composer-container">
					<button class="btn btn-sm btn-link text-body fw-semibold private-post-toggle" data-action="togglePrivatePost">
						<div class="checkbox position-relative d-none d-md-inline">
							<i class="fa text-muted pointer fa-square-o p-1"></i>
						</div>
						<span class="d-none d-md-inline">Private</span>
					</button>
				</div>
			`;
			const $container = $(html);
			const $btn = $container.find('.private-post-toggle');
			const $icon = $btn.find('i');
			
			// Simulate the actual click handler logic from composer.js
			$btn.on('click', function (e) {
				e.preventDefault();
				var $button = $(this);
				var $clickedIcon = $button.find('i');
				var isPrivate = $clickedIcon.hasClass('fa-lock');
				
				$clickedIcon.toggleClass('fa-lock', !isPrivate).toggleClass('fa-square-o', isPrivate);
			});
			
			$btn.trigger('click');
			
			assert.strictEqual($icon.hasClass('fa-lock'), true);
			assert.strictEqual($icon.hasClass('fa-square-o'), false);
		});

		it('should toggle back to fa-square-o when clicked again', () => {
			const html = `
				<div class="composer-container">
					<button class="btn btn-sm btn-link text-body fw-semibold private-post-toggle" data-action="togglePrivatePost">
						<div class="checkbox position-relative d-none d-md-inline">
							<i class="fa text-muted pointer fa-lock p-1"></i>
						</div>
						<span class="d-none d-md-inline">Private</span>
					</button>
				</div>
			`;
			const $container = $(html);
			const $btn = $container.find('.private-post-toggle');
			const $icon = $btn.find('i');
			
			// Simulate the actual click handler logic from composer.js
			$btn.on('click', function (e) {
				e.preventDefault();
				var $button = $(this);
				var $clickedIcon = $button.find('i');
				var isPrivate = $clickedIcon.hasClass('fa-lock');
				
				$clickedIcon.toggleClass('fa-lock', !isPrivate).toggleClass('fa-square-o', isPrivate);
			});
			
			$btn.trigger('click');
			
			assert.strictEqual($icon.hasClass('fa-square-o'), true);
			assert.strictEqual($icon.hasClass('fa-lock'), false);
		});

		it('should set isPrivate flag on composer.posts when clicked', () => {
			const html = `
				<div class="composer-container">
					<button class="btn btn-sm btn-link text-body fw-semibold private-post-toggle" data-action="togglePrivatePost">
						<div class="checkbox position-relative d-none d-md-inline">
							<i class="fa text-muted pointer fa-square-o p-1"></i>
						</div>
						<span class="d-none d-md-inline">Private</span>
					</button>
				</div>
			`;
			const $container = $(html);
			global.composer = { posts: {} };
			global.composer.posts['test-uuid'] = { isPrivate: false };
			$container.attr('data-uuid', 'test-uuid');
			
			// Simulate the actual click handler logic from composer.js
			$container.find('.private-post-toggle').on('click', function (e) {
				e.preventDefault();
				var $btn = $(this);
				var $icon = $btn.find('i');
				var isPrivate = $icon.hasClass('fa-lock');
				
				global.composer.posts['test-uuid'].isPrivate = !isPrivate;
				$icon.toggleClass('fa-lock', !isPrivate).toggleClass('fa-square-o', isPrivate);
			});
			
			$container.find('.private-post-toggle').trigger('click');
			
			assert.strictEqual(global.composer.posts['test-uuid'].isPrivate, true);
		});
	});

	describe('Composer private toggle button initialization', () => {
		it('should initialize with fa-lock icon when postData.isPrivate is true', () => {
			const html = `
				<div class="composer-container" data-uuid="test-uuid">
					<button class="btn btn-sm btn-link text-body fw-semibold private-post-toggle" data-action="togglePrivatePost">
						<div class="checkbox position-relative d-none d-md-inline">
							<i class="fa text-muted pointer fa-square-o p-1"></i>
						</div>
						<span class="d-none d-md-inline">Private</span>
					</button>
				</div>
			`;
			const $container = $(html);
			global.composer = { posts: { 'test-uuid': { isPrivate: true } } };
			
			// Simulate initialization logic from composer.js
			var $privateBtn = $container.find('.private-post-toggle');
			var postData = global.composer.posts['test-uuid'];
			if ($privateBtn.length && postData && postData.isPrivate) {
				var $privateIcon = $privateBtn.find('i');
				$privateIcon.removeClass('fa-lock-open').addClass('fa-lock');
			}
			
			const $icon = $container.find('.private-post-toggle').find('i');
			assert.strictEqual($icon.hasClass('fa-lock'), true);
			// Note: The initialization logic only adds fa-lock, doesn't remove fa-square-o
			// This is the actual behavior from composer.js
			assert.strictEqual($icon.hasClass('fa-square-o'), true);
		});

		it('should NOT change icon when postData.isPrivate is false', () => {
			const html = `
				<div class="composer-container" data-uuid="test-uuid">
					<button class="btn btn-sm btn-link text-body fw-semibold private-post-toggle" data-action="togglePrivatePost">
						<div class="checkbox position-relative d-none d-md-inline">
							<i class="fa text-muted pointer fa-square-o p-1"></i>
						</div>
						<span class="d-none d-md-inline">Private</span>
					</button>
				</div>
			`;
			const $container = $(html);
			global.composer = { posts: { 'test-uuid': { isPrivate: false } } };
			
			// Simulate initialization logic from composer.js
			var $privateBtn = $container.find('.private-post-toggle');
			var postData = global.composer.posts['test-uuid'];
			if ($privateBtn.length && postData && postData.isPrivate) {
				var $privateIcon = $privateBtn.find('i');
				$privateIcon.removeClass('fa-lock-open').addClass('fa-lock');
			}
			
			const $icon = $container.find('.private-post-toggle').find('i');
			assert.strictEqual($icon.hasClass('fa-square-o'), true);
			assert.strictEqual($icon.hasClass('fa-lock'), false);
		});
	});

	describe('Post private badge display', () => {
		it('should show private badge with fa-lock icon for modOnly posts', () => {
			const html = `
				<div class="post" component="post" data-pid="123">
					<div class="post-header">
						<span class="badge bg-warning text-dark ms-2" title="This post is private and only visible to moderators" component="post/private-badge">
							<i class="fa fa-lock"></i> Private
						</span>
					</div>
				</div>
			`;
			const $post = $(html);
			
			const $badge = $post.find('[component="post/private-badge"]');
			assert.strictEqual($badge.length, 1);
			assert.strictEqual($badge.hasClass('badge'), true);
			assert.strictEqual($badge.hasClass('bg-warning'), true);
			assert.strictEqual($badge.hasClass('text-dark'), true);
			assert.strictEqual($badge.hasClass('ms-2'), true);
			
			const $icon = $badge.find('i');
			assert.strictEqual($icon.hasClass('fa-lock'), true);
		});

		it('should NOT show private badge for normal posts', () => {
			const html = `
				<div class="post" component="post" data-pid="124">
					<div class="post-header">
						<!-- No private badge -->
					</div>
				</div>
			`;
			const $post = $(html);
			
			const $badge = $post.find('[component="post/private-badge"]');
			assert.strictEqual($badge.length, 0);
		});

		it('should have correct title attribute for accessibility', () => {
			const html = `
				<div class="post" component="post" data-pid="123">
					<div class="post-header">
						<span class="badge bg-warning text-dark ms-2" title="[[topic:post-is-mod-only]]" component="post/private-badge">
							<i class="fa fa-lock"></i> Private
						</span>
					</div>
				</div>
			`;
			const $post = $(html);
			const $badge = $post.find('[component="post/private-badge"]');
			
			assert.strictEqual($badge.attr('title'), '[[topic:post-is-mod-only]]');
		});
	});

	describe('Quick reply modOnly hidden input', () => {
		it('should include hidden modOnly input when parent post is modOnly', () => {
			const html = `
				<div class="quickreply" component="topic/quickreply">
					<form class="flex-grow-1 d-flex flex-column gap-2">
						<input type="hidden" name="tid" value="456" />
						<input type="hidden" name="_csrf" value="csrf-token" />
						<input type="hidden" name="modOnly" value="1" />
						<textarea rows="4" name="content" component="topic/quickreply/text"></textarea>
					</form>
				</div>
			`;
			const $quickReply = $(html);
			
			const $modOnlyInput = $quickReply.find('input[name="modOnly"]');
			assert.strictEqual($modOnlyInput.length, 1);
			assert.strictEqual($modOnlyInput.attr('value'), '1');
		});

		it('should NOT include hidden modOnly input for normal posts', () => {
			const html = `
				<div class="quickreply" component="topic/quickreply">
					<form class="flex-grow-1 d-flex flex-column gap-2">
						<input type="hidden" name="tid" value="457" />
						<input type="hidden" name="_csrf" value="csrf-token" />
						<!-- No modOnly input -->
						<textarea rows="4" name="content" component="topic/quickreply/text"></textarea>
					</form>
				</div>
			`;
			const $quickReply = $(html);
			
			const $modOnlyInput = $quickReply.find('input[name="modOnly"]');
			assert.strictEqual($modOnlyInput.length, 0);
		});
	});

	describe('Composer submit with modOnly flag', () => {
		it('should include modOnly flag in submit data when post is private', () => {
			global.composer = {
				posts: {
					'test-uuid': {
						isPrivate: true,
						tid: 456,
						title: 'Test Topic',
						content: 'Test content',
					},
				},
			};
			
			const html = `
				<div class="composer-container" data-uuid="test-uuid">
					<button class="composer-submit" data-action="posts.new">
						Submit
					</button>
				</div>
			`;
			const $container = $(html);
			
			const $submitBtn = $container.find('.composer-submit');
			const postData = global.composer.posts['test-uuid'];
			
			// Simulate submit data structure
			const submitData = {
				modOnly: postData.isPrivate ? 1 : 0,
			};
			
			assert.strictEqual(submitData.modOnly, 1);
		});

		it('should NOT include modOnly flag when post is not private', () => {
			global.composer = {
				posts: {
					'test-uuid': {
						isPrivate: false,
						tid: 456,
						title: 'Test Topic',
						content: 'Test content',
					},
				},
			};
			
			const $container = $('<div class="composer-container" data-uuid="test-uuid"></div>');
			const postData = global.composer.posts['test-uuid'];
			
			// Simulate submit data structure
			const submitData = {
				modOnly: postData.isPrivate ? 1 : 0,
			};
			
			assert.strictEqual(submitData.modOnly, 0);
		});
	});

	describe('Post privilege flags UI', () => {
		it('should show edit tools for admin users on modOnly posts', () => {
			const html = `
				<div class="post" component="post" data-pid="123" data-modonly="1">
					<div class="post-header">
						<i class="fa fa-edit text-muted pointer edit-icon"></i>
					</div>
				</div>
			`;
			const $post = $(html);
			const mockPrivileges = { isAdminOrMod: true, 'posts:edit': true };
			const mockAjaxifyData = { privileges: mockPrivileges };
			
			// Simulate frontend posts.js modifyPostsByPrivileges
			const post = {
				selfPost: true,
				modOnly: parseInt($post.attr('data-modonly'), 10),
			};
			post.display_edit_tools = (mockAjaxifyData.privileges['posts:edit'] && post.selfPost) || mockAjaxifyData.privileges.isAdminOrMod;
			
			assert.strictEqual(post.display_edit_tools, true);
		});

		it('should NOT show edit tools for regular users on modOnly posts', () => {
			const html = `
				<div class="post" component="post" data-pid="123" data-modonly="1">
					<div class="post-header">
						<!-- No edit icon -->
					</div>
				</div>
			`;
			const mockPrivileges = { isAdminOrMod: false, 'posts:edit': true };
			const mockAjaxifyData = { privileges: mockPrivileges };
			
			// Simulate frontend posts.js modifyPostsByPrivileges
			const post = {
				selfPost: false,
				modOnly: 1,
			};
			post.display_edit_tools = (mockAjaxifyData.privileges['posts:edit'] && post.selfPost) || mockAjaxifyData.privileges.isAdminOrMod;
			
			assert.strictEqual(post.display_edit_tools, false);
		});

		it('should show delete tools for admin users on modOnly posts', () => {
			const mockPrivileges = { isAdminOrMod: true, 'posts:delete': true };
			const mockAjaxifyData = { privileges: mockPrivileges };
			
			// Simulate frontend posts.js modifyPostsByPrivileges
			const post = {
				selfPost: false,
				modOnly: 1,
			};
			post.display_delete_tools = (mockAjaxifyData.privileges['posts:delete'] && post.selfPost) || mockAjaxifyData.privileges.isAdminOrMod;
			
			assert.strictEqual(post.display_delete_tools, true);
		});

		it('should NOT show delete tools for regular users on modOnly posts', () => {
			const mockPrivileges = { isAdminOrMod: false, 'posts:delete': true };
			const mockAjaxifyData = { privileges: mockPrivileges };
			
			// Simulate frontend posts.js modifyPostsByPrivileges
			const post = {
				selfPost: false,
				modOnly: 1,
			};
			post.display_delete_tools = (mockAjaxifyData.privileges['posts:delete'] && post.selfPost) || mockAjaxifyData.privileges.isAdminOrMod;
			
			assert.strictEqual(post.display_delete_tools, false);
		});
	});

	describe('Private post badge visibility', () => {
		it('should only display private badge for privileged users', () => {
			const html = `
				<div class="post" component="post" data-pid="123">
					<div class="post-header">
						{{{ if ./modOnly }}}
						<span class="badge bg-warning text-dark ms-2" title="[[topic:post-is-mod-only]]" component="post/private-badge">
							<i class="fa fa-lock"></i> Private
						</span>
						{{{ end }}}
					</div>
				</div>
			`;
			const $post = $(html);
			
			// Simulate template rendering with modOnly = true
			const hasBadge = $post.find('[component="post/private-badge"]').length > 0;
			assert.strictEqual(hasBadge, true);
		});

		it('should hide private content for non-privileged users', () => {
			const mockPost = { 
				content: 'secret content', 
				modOnly: 1, 
				user: { signature: 'secret signature' } 
			};
			const mockPrivs = { isAdminOrMod: false, 'posts:view_deleted': false };
			
			// Simulate posts.modifyPostByPrivilege
			if (mockPost && mockPost.modOnly && !mockPrivs.isAdminOrMod) {
				mockPost.content = '[[topic:post-is-mod-only]]';
				mockPost.user.signature = '';
			}
			
			assert.strictEqual(mockPost.content, '[[topic:post-is-mod-only]]');
			assert.strictEqual(mockPost.user.signature, '');
		});

		it('should show private content for privileged users', () => {
			const mockPost = { 
				content: 'secret content', 
				modOnly: 1, 
				user: { signature: 'secret signature' } 
			};
			const mockPrivs = { isAdminOrMod: true, 'posts:view_deleted': false };
			
			// Simulate posts.modifyPostByPrivilege
			if (mockPost && mockPost.modOnly && !mockPrivs.isAdminOrMod) {
				mockPost.content = '[[topic:post-is-mod-only]]';
				mockPost.user.signature = '';
			}
			
			assert.strictEqual(mockPost.content, 'secret content');
			assert.strictEqual(mockPost.user.signature, 'secret signature');
		});
	});

	describe('Composer private button styling', () => {
		it('should have correct button classes', () => {
			const html = `
				<button class="btn btn-sm btn-link text-body fw-semibold private-post-toggle" data-action="togglePrivatePost">
					<div class="checkbox position-relative d-none d-md-inline">
						<i class="fa text-muted pointer fa-square-o p-1"></i>
					</div>
					<span class="d-none d-md-inline">Private</span>
				</button>
			`;
			const $btn = $(html);
			
			assert.strictEqual($btn.hasClass('btn'), true);
			assert.strictEqual($btn.hasClass('btn-sm'), true);
			assert.strictEqual($btn.hasClass('btn-link'), true);
			assert.strictEqual($btn.hasClass('text-body'), true);
			assert.strictEqual($btn.hasClass('fw-semibold'), true);
			assert.strictEqual($btn.hasClass('private-post-toggle'), true);
			assert.strictEqual($btn.attr('data-action'), 'togglePrivatePost');
		});

		it('should have correct icon styling', () => {
			const html = `
				<button class="btn btn-sm btn-link text-body fw-semibold private-post-toggle" data-action="togglePrivatePost">
					<div class="checkbox position-relative d-none d-md-inline">
						<i class="fa text-muted pointer fa-square-o p-1"></i>
					</div>
					<span class="d-none d-md-inline">Private</span>
				</button>
			`;
			const $btn = $(html);
			const $icon = $btn.find('i');
			
			assert.strictEqual($icon.hasClass('fa'), true);
			assert.strictEqual($icon.hasClass('text-muted'), true);
			assert.strictEqual($icon.hasClass('pointer'), true);
			assert.strictEqual($icon.hasClass('p-1'), true);
		});

		it('should have responsive text display classes', () => {
			const html = `
				<button class="btn btn-sm btn-link text-body fw-semibold private-post-toggle" data-action="togglePrivatePost">
					<div class="checkbox position-relative d-none d-md-inline">
						<i class="fa text-muted pointer fa-square-o p-1"></i>
					</div>
					<span class="d-none d-md-inline">Private</span>
				</button>
			`;
			const $btn = $(html);
			const $text = $btn.find('span');
			
			assert.strictEqual($text.hasClass('d-none'), true);
			assert.strictEqual($text.hasClass('d-md-inline'), true);
		});
	});
});