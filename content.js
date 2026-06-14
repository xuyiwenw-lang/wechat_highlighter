// ==UserScript==
// @name         wechat_highlighter (修复版)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  针对微信公众号文章，提供段落悬浮高亮功能
// @author       yiwen
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 样式注入 ---
    const style = document.createElement('style');
    style.textContent = `
        .highlightable-sentence {
            padding: 2px 0; /* 稍微减小padding防止行高突变 */
            border-radius: 2px;
            transition: background-color 0.1s ease-in-out;
        }

        .highlightable-sentence:hover {
            background-color: #FFD700 !important;
            cursor: text;
            box-shadow: 0 0 2px #FFD700; /* 增加一点光晕效果 */
        }

        body, .WB_artical_content, .ql-editor, * {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
        }

        [class="mask"], [class*="cover"] {
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(style);

    // --- 功能 1: 解除复制和选择限制 ---
    function enableCopyingAndSelection() {
        const eventsToOverride = ['selectstart', 'copy', 'contextmenu', 'mousedown'];

        eventsToOverride.forEach(eventName => {
            document.addEventListener(eventName, (event) => {
                event.stopPropagation();
            }, true);
        });
        console.log('wechat_highlighter：已注入防限制脚本。');
    }

    // --- 辅助: 寻找文章容器 ---
    function findArticleContent() {
        const selectors = [
            '.circle-detail-content',
            '.WB_editor_iframe_new',
            '.WB_artical',
            '#js_content', // 微信公众号
            '.ql-editor',
            '.article-content',
            '.WB_artical_content',
            '.detail_body',
            'article',     // 通用标签
            '.post-content'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                console.log('wechat_highlighter：成功找到文章容器 ->', selector);
                return element;
            }
        }
        console.log('wechat_highlighter：未能找到目标文章容器。');
        return null;
    }

    // --- 功能 2: 句子高亮 (核心逻辑修复) ---
    function highlightSentencesIn(articleContent) {
        if (!articleContent || articleContent.dataset.sentenceHighlighted === 'true') {
            return;
        }

        articleContent.dataset.sentenceHighlighted = 'true';
        console.log('wechat_highlighter：开始处理句子高亮...');

        // 排除代码块、表格等不适合高亮的区域
        const elements = articleContent.querySelectorAll('p, div, section, h1, h2, h3, h4, li');

        elements.forEach(el => {
            // 如果已经在高亮句子里，或者是在代码块/表格里，跳过
            if (el.closest('.highlightable-sentence') || el.closest('pre') || el.closest('code')) return;

            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];

            let currentNode;
            while (currentNode = walker.nextNode()) {
                if (
                    currentNode.textContent.trim() !== '' &&
                    currentNode.parentElement.tagName !== 'A' && // 不破坏链接
                    currentNode.parentElement.tagName !== 'SCRIPT' &&
                    currentNode.parentElement.tagName !== 'STYLE' &&
                    !currentNode.parentElement.classList.contains('highlightable-sentence')
                ) {
                    textNodes.push(currentNode);
                }
            }

            textNodes.forEach(node => {
                // ============================================================
                // 核心修复：改良后的正则表达式
                // 1. (?<=[。！？；…]) : 遇到中文标点，直接切分。
                // 2. (?<=[.!?])(?=\s|$) : 遇到英文标点，必须后面紧跟空格或字符串结束才切分。
                // 3. 移除了 \n : 源码里的换行符不再作为切分依据，解决了"24年"被切断的问题。
                // ============================================================
                const regex = /(?<=[。！？；…])|(?<=[.!?])(?=\s|$)/g;
                
                const sentences = node.textContent.split(regex);
                const fragment = document.createDocumentFragment();
                let processed = false;

                sentences.forEach(sentence => {
                    // 只有当句子包含有效字符（不仅仅是换行或空格）时才包裹
                    if (sentence.trim()) {
                        const span = document.createElement('span');
                        span.className = 'highlightable-sentence';
                        span.textContent = sentence;
                        fragment.appendChild(span);
                        processed = true;
                    } else if (sentence.length > 0) {
                        // 保留纯空格或换行符，但不加高亮样式
                        fragment.appendChild(document.createTextNode(sentence));
                    }
                });

                if (processed && node.parentNode) {
                    node.parentNode.replaceChild(fragment, node);
                }
            });
        });

        console.log('wechat_highlighter：句子高亮处理完成！');
    }

    // --- 初始化与监听 ---
    enableCopyingAndSelection();

    let highlightDebounceTimer;

    const observer = new MutationObserver((mutations) => {
        clearTimeout(highlightDebounceTimer);
        highlightDebounceTimer = setTimeout(() => {
            const articleContent = findArticleContent();
            if (articleContent && !articleContent.dataset.sentenceHighlighted) {
                highlightSentencesIn(articleContent);
            }
        }, 700);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    window.addEventListener('load', () => {
        setTimeout(() => {
            const articleContent = findArticleContent();
            if (articleContent && !articleContent.dataset.sentenceHighlighted) {
                highlightSentencesIn(articleContent);
            }
        }, 1200);
    });

})();