// 北森笔试刷题APP - 核心逻辑
(function() {
    'use strict';

    // ========== 数据存储 ==========
    const STORAGE_KEY = 'beisen_exam_app_v1';
    
    let appData = {
        progress: {},      // { questionId: 'correct' | 'wrong' }
        wrong: [],         // 错题ID列表
        favorites: [],     // 收藏ID列表
        examHistory: []    // 考试历史
    };

    function loadData() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                appData = JSON.parse(saved);
            }
        } catch(e) {
            console.error('加载数据失败', e);
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        } catch(e) {
            console.error('保存数据失败', e);
        }
    }

    // ========== 工具函数 ==========
    function getQuestionById(id) {
        return window.QUESTIONS.find(q => q.id === id);
    }

    function getQuestionsByCategory(category) {
        if (category === 'all') return window.QUESTIONS;
        return window.QUESTIONS.filter(q => q.category === category);
    }

    function shuffleArray(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    // ========== 视图切换 ==========
    function showView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-' + viewName);
        if (target) target.classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
        if (navItem) navItem.classList.add('active');

        // 更新标题
        const titles = {
            home: '北森笔试刷题',
            practice: '刷题练习',
            exam: '模拟考试',
            wrong: '错题本',
            favorites: '收藏夹',
            stats: '学习统计'
        };
        document.getElementById('headerTitle').textContent = titles[viewName] || '北森笔试刷题';

        // 刷新对应视图
        if (viewName === 'home') renderHome();
        if (viewName === 'wrong') renderWrongList();
        if (viewName === 'favorites') renderFavoritesList();
        if (viewName === 'stats') renderStats();
        if (viewName === 'exam') renderExamSetup();
    }

    // ========== 首页渲染 ==========
    function renderHome() {
        const total = window.QUESTIONS.length;
        const done = Object.keys(appData.progress).length;
        const correct = Object.values(appData.progress).filter(v => v === 'correct').length;
        const accuracy = done > 0 ? Math.round(correct / done * 100) : 0;

        document.getElementById('totalQuestions').textContent = total;
        document.getElementById('doneCount').textContent = done;
        document.getElementById('accuracyRate').textContent = accuracy + '%';
        document.getElementById('totalProgress').style.width = (done / total * 100) + '%';
        document.getElementById('progressText').textContent = `已完成 ${done} / ${total} 题`;

        // 分类列表
        const categoryList = document.getElementById('categoryList');
        categoryList.innerHTML = '';
        
        Object.entries(window.QUESTION_CATEGORIES).forEach(([key, cat]) => {
            const catQuestions = getQuestionsByCategory(key);
            const catDone = catQuestions.filter(q => appData.progress[q.id]).length;
            const catCorrect = catQuestions.filter(q => appData.progress[q.id] === 'correct').length;
            const catAccuracy = catDone > 0 ? Math.round(catCorrect / catDone * 100) : 0;

            const card = document.createElement('div');
            card.className = 'category-card';
            card.onclick = () => startCategoryPractice(key);
            card.innerHTML = `
                <div class="category-icon">${cat.icon}</div>
                <div class="category-name">${cat.name}</div>
                <div class="category-info">${cat.count}题 · 已做${catDone} · 正确率${catAccuracy}%</div>
                <div class="category-progress">
                    <div class="category-progress-fill" style="width:${catDone > 0 ? catDone/cat.count*100 : 0}%"></div>
                </div>
            `;
            categoryList.appendChild(card);
        });

        // 真题卷列表
        renderPaperList();
    }

    function renderPaperList() {
        const paperList = document.getElementById('paperList');
        if (!paperList || !window.EXAM_PAPERS || !window.EXAM_PAPERS.length) return;
        paperList.innerHTML = '';
        window.EXAM_PAPERS.forEach((paper, idx) => {
            const card = document.createElement('div');
            card.className = 'paper-card';
            card.innerHTML = `
                <div class="paper-header">
                    <div class="paper-name">📄 ${paper.name}</div>
                    <div class="paper-count">${paper.questions.length}题</div>
                </div>
                <div class="paper-desc">${paper.description || ''}</div>
                <div class="paper-actions">
                    <button class="paper-action-btn memorize" onclick="event.stopPropagation();startPaperPractice(${idx}, true)">📖 背题模式</button>
                    <button class="paper-action-btn practice" onclick="event.stopPropagation();startPaperPractice(${idx}, false)">✏️ 刷题模式</button>
                </div>
            `;
            paperList.appendChild(card);
        });
    }

    // ========== 刷题功能 ==========
    let practiceState = {
        questions: [],
        currentIndex: 0,
        mode: 'sequential', // sequential | random | wrong | favorites | review
        category: 'all',
        userAnswers: {},
        memorizeMode: false
    };

    function startCategoryPractice(category) {
        const questions = getQuestionsByCategory(category);
        practiceState = {
            questions: questions,
            currentIndex: 0,
            mode: 'sequential',
            category: category,
            userAnswers: {},
            memorizeMode: false
        };
        showView('practice');
        renderPracticeQuestion();
    }

    function startPaperPractice(paperIndex, memorize) {
        const paper = window.EXAM_PAPERS[paperIndex];
        if (!paper) return;
        practiceState = {
            questions: paper.questions,
            currentIndex: 0,
            mode: 'paper',
            category: paper.name,
            userAnswers: {},
            memorizeMode: memorize
        };
        showView('practice');
        renderPracticeQuestion();
    }

    function toggleMemorizeMode() {
        practiceState.memorizeMode = !practiceState.memorizeMode;
        const btn = document.getElementById('memorizeToggle');
        if (btn) {
            btn.textContent = practiceState.memorizeMode ? '📖 背题中' : '📖 背题模式';
            btn.classList.toggle('active', practiceState.memorizeMode);
        }
        renderPracticeQuestion();
    }

    function startRandomPractice() {
        const questions = shuffleArray(window.QUESTIONS);
        practiceState = {
            questions: questions,
            currentIndex: 0,
            mode: 'random',
            category: 'all',
            userAnswers: {},
            memorizeMode: false
        };
        showView('practice');
        renderPracticeQuestion();
    }

    function startWrongPractice() {
        const wrongQuestions = appData.wrong.map(id => getQuestionById(id)).filter(Boolean);
        if (wrongQuestions.length === 0) {
            alert('暂无错题');
            return;
        }
        practiceState = {
            questions: wrongQuestions,
            currentIndex: 0,
            mode: 'wrong',
            category: 'wrong',
            userAnswers: {}
        };
        showView('practice');
        renderPracticeQuestion();
    }

    function startFavoritePractice() {
        const favQuestions = appData.favorites.map(id => getQuestionById(id)).filter(Boolean);
        if (favQuestions.length === 0) {
            alert('暂无收藏题目');
            return;
        }
        practiceState = {
            questions: favQuestions,
            currentIndex: 0,
            mode: 'favorites',
            category: 'favorites',
            userAnswers: {}
        };
        showView('practice');
        renderPracticeQuestion();
    }

    function renderPracticeQuestion() {
        const q = practiceState.questions[practiceState.currentIndex];
        if (!q) return;

        const catInfo = window.QUESTION_CATEGORIES[q.category] || {};
        document.getElementById('practiceCategory').textContent = catInfo.name || q.category;
        document.getElementById('practiceProgress').textContent = `${practiceState.currentIndex + 1} / ${practiceState.questions.length}`;
        document.getElementById('practiceProgressFill').style.width = ((practiceState.currentIndex + 1) / practiceState.questions.length * 100) + '%';

        // 背题模式按钮状态
        const memorizeBtn = document.getElementById('memorizeToggle');
        if (memorizeBtn) {
            memorizeBtn.classList.toggle('active', practiceState.memorizeMode);
            memorizeBtn.textContent = practiceState.memorizeMode ? '📖 背题中' : '📖 背题模式';
        }

        // 收藏按钮状态
        const favBtn = document.getElementById('favBtn');
        favBtn.textContent = appData.favorites.includes(q.id) ? '★' : '☆';
        favBtn.classList.toggle('active', appData.favorites.includes(q.id));

        // 渲染题目
        const container = document.getElementById('questionContainer');
        // 背题模式下，直接显示答案（传入一个假的userAnswer = 正确答案）
        const displayAnswer = practiceState.memorizeMode ? q.answer : practiceState.userAnswers[q.id];
        container.innerHTML = renderQuestionCard(q, displayAnswer, true);

        // 绑定选项点击（背题模式下禁用）
        if (!practiceState.memorizeMode) {
            container.querySelectorAll('.option-item').forEach(item => {
                item.onclick = () => selectPracticeOption(item.dataset.letter);
            });
        }

        // 导航按钮状态
        document.getElementById('prevBtn').disabled = practiceState.currentIndex === 0;
        document.getElementById('nextBtn').textContent = practiceState.currentIndex === practiceState.questions.length - 1 ? '完成' : '下一题';
    }

    function renderQuestionCard(q, userAnswer, showAnswer) {
        const isGraph = q.type === 'graph';
        const answered = userAnswer !== undefined;
        const isCorrect = answered && userAnswer === q.answer;

        let optionsHtml = '';
        if (isGraph) {
            // 图形题：选项在图片中，显示A/B/C/D/E按钮
            const optionLetters = ['A','B','C','D','E'];
            optionsHtml = '<div class="options-list">';
            optionLetters.forEach(letter => {
                let cls = 'option-item';
                if (answered) {
                    cls += ' disabled';
                    if (letter === q.answer) cls += ' correct';
                    if (letter === userAnswer && letter !== q.answer) cls += ' wrong';
                } else if (userAnswer === letter) {
                    cls += ' selected';
                }
                optionsHtml += `
                    <div class="${cls}" data-letter="${letter}">
                        <div class="option-letter">${letter}</div>
                        <div class="option-text">选项 ${letter}（见上图）</div>
                    </div>
                `;
            });
            optionsHtml += '</div>';
        } else {
            // 文字题
            optionsHtml = '<div class="options-list">';
            Object.entries(q.options).sort((a,b) => a[0].localeCompare(b[0])).forEach(([letter, text]) => {
                let cls = 'option-item';
                if (answered) {
                    cls += ' disabled';
                    if (letter === q.answer) cls += ' correct';
                    if (letter === userAnswer && letter !== q.answer) cls += ' wrong';
                } else if (userAnswer === letter) {
                    cls += ' selected';
                }
                optionsHtml += `
                    <div class="${cls}" data-letter="${letter}">
                        <div class="option-letter">${letter}</div>
                        <div class="option-text">${escapeHtml(text)}</div>
                    </div>
                `;
            });
            optionsHtml += '</div>';
        }

        // 图片
        let imagesHtml = '';
        if (q.images && q.images.length > 0) {
            imagesHtml = '<div class="question-images">';
            q.images.forEach((img, idx) => {
                const label = isGraph ? (idx === 0 ? '题目图形' : '选项图形（从上到下 A/B/C/D/E）') : `图片${idx+1}`;
                imagesHtml += `<div class="image-label">${label}</div>`;
                imagesHtml += `<img src="${img}" alt="题目图片" loading="lazy">`;
            });
            imagesHtml += '</div>';
        }

        // 答案解析
        let answerHtml = '';
        if (answered && showAnswer) {
            answerHtml = `
                <div class="answer-section show">
                    <div class="answer-label ${isCorrect ? 'correct' : 'wrong'}">
                        ${isCorrect ? '✓ 回答正确' : '✗ 回答错误'} · 正确答案：${q.answer}
                    </div>
                    ${q.explanation ? `<div class="explanation-text"><strong>解析：</strong>${escapeHtml(q.explanation)}</div>` : ''}
                </div>
            `;
        }

        return `
            <div class="question-card">
                <div class="question-meta">
                    <span class="question-tag">${q.category}</span>
                    ${q.source ? `<span class="question-tag">${q.source}</span>` : ''}
                    ${isGraph ? '<span class="question-tag">图形推理</span>' : ''}
                </div>
                <div class="question-stem">${escapeHtml(q.stem)}</div>
                ${imagesHtml}
                ${optionsHtml}
                ${answerHtml}
            </div>
        `;
    }

    function selectPracticeOption(letter) {
        const q = practiceState.questions[practiceState.currentIndex];
        if (!q || practiceState.userAnswers[q.id] !== undefined) return;

        practiceState.userAnswers[q.id] = letter;
        
        // 记录进度
        const isCorrect = letter === q.answer;
        appData.progress[q.id] = isCorrect ? 'correct' : 'wrong';
        
        // 错题管理
        if (isCorrect) {
            appData.wrong = appData.wrong.filter(id => id !== q.id);
        } else {
            if (!appData.wrong.includes(q.id)) {
                appData.wrong.push(q.id);
            }
        }
        
        saveData();
        renderPracticeQuestion();
    }

    function prevQuestion() {
        if (practiceState.currentIndex > 0) {
            practiceState.currentIndex--;
            renderPracticeQuestion();
        }
    }

    function nextQuestion() {
        if (practiceState.currentIndex < practiceState.questions.length - 1) {
            practiceState.currentIndex++;
            renderPracticeQuestion();
        } else {
            // 完成
            const done = Object.keys(practiceState.userAnswers).length;
            const correct = Object.entries(practiceState.userAnswers).filter(([id, ans]) => {
                const q = getQuestionById(id);
                return q && ans === q.answer;
            }).length;
            alert(`练习完成！\n共 ${practiceState.questions.length} 题，已做 ${done} 题，正确 ${correct} 题，正确率 ${done > 0 ? Math.round(correct/done*100) : 0}%`);
            showView('home');
        }
    }

    function exitPractice() {
        if (confirm('确定退出练习吗？')) {
            showView('home');
        }
    }

    function toggleFavorite() {
        const q = practiceState.questions[practiceState.currentIndex];
        if (!q) return;
        
        const idx = appData.favorites.indexOf(q.id);
        if (idx >= 0) {
            appData.favorites.splice(idx, 1);
        } else {
            appData.favorites.push(q.id);
        }
        saveData();
        renderPracticeQuestion();
    }

    // ========== 模拟考试 ==========
    let examState = {
        questions: [],
        currentIndex: 0,
        userAnswers: {},
        duration: 1800,
        startTime: null,
        timerInterval: null,
        timeLeft: 1800
    };

    function renderExamSetup() {
        // 填充分类选项
        const select = document.getElementById('examCategory');
        select.innerHTML = '<option value="all">全部题库</option>';
        Object.entries(window.QUESTION_CATEGORIES).forEach(([key, cat]) => {
            select.innerHTML += `<option value="${key}">${cat.name}（${cat.count}题）</option>`;
        });
    }

    function startMockExam() {
        showView('exam');
    }

    function startExam() {
        const count = parseInt(document.getElementById('examCount').value);
        const category = document.getElementById('examCategory').value;
        const duration = parseInt(document.getElementById('examDuration').value) * 60;

        let pool = getQuestionsByCategory(category);
        if (pool.length < count) {
            alert(`该分类只有 ${pool.length} 题，不足 ${count} 题`);
            return;
        }

        examState = {
            questions: shuffleArray(pool).slice(0, count),
            currentIndex: 0,
            userAnswers: {},
            duration: duration,
            startTime: Date.now(),
            timerInterval: null,
            timeLeft: duration
        };

        document.getElementById('examSetup').style.display = 'none';
        document.getElementById('examRunning').style.display = 'block';
        document.getElementById('examResult').style.display = 'none';

        startExamTimer();
        renderExamQuestion();
        renderExamNav();
    }

    function startExamTimer() {
        updateExamTimerDisplay();
        examState.timerInterval = setInterval(() => {
            examState.timeLeft--;
            updateExamTimerDisplay();
            if (examState.timeLeft <= 0) {
                clearInterval(examState.timerInterval);
                submitExam(true);
            }
        }, 1000);
    }

    function updateExamTimerDisplay() {
        const timer = document.getElementById('examTimer');
        timer.textContent = formatTime(examState.timeLeft);
        timer.classList.toggle('warning', examState.timeLeft <= 60);
    }

    function renderExamQuestion() {
        const q = examState.questions[examState.currentIndex];
        if (!q) return;

        document.getElementById('examProgress').textContent = `${examState.currentIndex + 1} / ${examState.questions.length}`;

        const container = document.getElementById('examQuestionContainer');
        container.innerHTML = renderQuestionCard(q, examState.userAnswers[q.id], false);

        container.querySelectorAll('.option-item').forEach(item => {
            item.onclick = () => selectExamOption(item.dataset.letter);
        });

        document.getElementById('examPrevBtn').disabled = examState.currentIndex === 0;
        document.getElementById('examNextBtn').textContent = examState.currentIndex === examState.questions.length - 1 ? '完成' : '下一题';
        
        renderExamNav();
    }

    function selectExamOption(letter) {
        const q = examState.questions[examState.currentIndex];
        if (!q) return;
        examState.userAnswers[q.id] = letter;
        renderExamQuestion();
    }

    function examPrevQuestion() {
        if (examState.currentIndex > 0) {
            examState.currentIndex--;
            renderExamQuestion();
        }
    }

    function examNextQuestion() {
        if (examState.currentIndex < examState.questions.length - 1) {
            examState.currentIndex++;
            renderExamQuestion();
        } else {
            if (confirm('确定要交卷吗？')) {
                submitExam();
            }
        }
    }

    function jumpToExamQuestion(index) {
        examState.currentIndex = index;
        renderExamQuestion();
    }

    function renderExamNav() {
        const nav = document.getElementById('examQuestionNav');
        nav.innerHTML = '';
        examState.questions.forEach((q, idx) => {
            const item = document.createElement('div');
            item.className = 'q-nav-item';
            if (examState.userAnswers[q.id]) item.classList.add('answered');
            if (idx === examState.currentIndex) item.classList.add('current');
            item.textContent = idx + 1;
            item.onclick = () => jumpToExamQuestion(idx);
            nav.appendChild(item);
        });
    }

    function submitExam(timeUp) {
        clearInterval(examState.timerInterval);
        
        const total = examState.questions.length;
        const answered = Object.keys(examState.userAnswers).length;
        let correct = 0;
        examState.questions.forEach(q => {
            if (examState.userAnswers[q.id] === q.answer) correct++;
        });
        const score = Math.round(correct / total * 100);
        const wrong = answered - correct;
        const timeUsed = examState.duration - examState.timeLeft;

        // 记录考试历史
        appData.examHistory.unshift({
            date: new Date().toLocaleString('zh-CN'),
            total: total,
            correct: correct,
            score: score,
            timeUsed: timeUsed,
            duration: examState.duration
        });
        if (appData.examHistory.length > 20) appData.examHistory = appData.examHistory.slice(0, 20);

        // 更新题目进度
        examState.questions.forEach(q => {
            const userAns = examState.userAnswers[q.id];
            if (userAns) {
                const isCorrect = userAns === q.answer;
                appData.progress[q.id] = isCorrect ? 'correct' : 'wrong';
                if (isCorrect) {
                    appData.wrong = appData.wrong.filter(id => id !== q.id);
                } else {
                    if (!appData.wrong.includes(q.id)) appData.wrong.push(q.id);
                }
            }
        });
        saveData();

        // 显示结果
        document.getElementById('examRunning').style.display = 'none';
        const resultDiv = document.getElementById('examResult');
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div class="exam-result-card">
                <div style="font-size:16px;color:var(--text-secondary);">${timeUp ? '考试时间到，自动交卷' : '考试完成'}</div>
                <div class="exam-score">${score}<span style="font-size:20px;">分</span></div>
                <div class="exam-result-stats">
                    <div class="exam-result-item">
                        <div class="num" style="color:var(--success);">${correct}</div>
                        <div class="label">正确</div>
                    </div>
                    <div class="exam-result-item">
                        <div class="num" style="color:var(--danger);">${wrong}</div>
                        <div class="label">错误</div>
                    </div>
                    <div class="exam-result-item">
                        <div class="num">${total - answered}</div>
                        <div class="label">未答</div>
                    </div>
                    <div class="exam-result-item">
                        <div class="num">${formatTime(timeUsed)}</div>
                        <div class="label">用时</div>
                    </div>
                </div>
                <div class="result-actions">
                    <button class="nav-btn" onclick="showExamReview()">查看解析</button>
                    <button class="nav-btn primary" onclick="restartExam()">再考一次</button>
                </div>
            </div>
        `;
    }

    let examReviewState = { questions: [], currentIndex: 0, userAnswers: {} };

    function showExamReview() {
        examReviewState = {
            questions: examState.questions,
            currentIndex: 0,
            userAnswers: examState.userAnswers
        };
        
        // 复用刷题视图显示解析
        practiceState = {
            questions: examState.questions,
            currentIndex: 0,
            mode: 'review',
            category: 'exam_review',
            userAnswers: examState.userAnswers
        };
        showView('practice');
        renderPracticeQuestion();
    }

    function restartExam() {
        document.getElementById('examResult').style.display = 'none';
        document.getElementById('examSetup').style.display = 'block';
    }

    // ========== 错题本 ==========
    function renderWrongList() {
        const list = document.getElementById('wrongList');
        document.getElementById('wrongCount').textContent = `共 ${appData.wrong.length} 道错题`;
        
        if (appData.wrong.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎉</div><div>暂无错题，继续加油！</div></div>';
            return;
        }

        list.innerHTML = '';
        // 添加重做按钮
        const redoBtn = document.createElement('button');
        redoBtn.className = 'nav-btn primary';
        redoBtn.style.marginBottom = '12px';
        redoBtn.textContent = '重做全部错题';
        redoBtn.onclick = startWrongPractice;
        list.appendChild(redoBtn);

        appData.wrong.forEach(id => {
            const q = getQuestionById(id);
            if (!q) return;
            const item = document.createElement('div');
            item.className = 'question-list-item';
            item.onclick = () => {
                practiceState = {
                    questions: [q],
                    currentIndex: 0,
                    mode: 'single',
                    category: q.category,
                    userAnswers: {}
                };
                showView('practice');
                renderPracticeQuestion();
            };
            item.innerHTML = `
                <div class="question-list-stem">${escapeHtml(q.stem)}</div>
                <div class="question-list-meta">
                    <span>${q.category}</span>
                    <span>正确答案：${q.answer}</span>
                </div>
            `;
            list.appendChild(item);
        });
    }

    // ========== 收藏夹 ==========
    function renderFavoritesList() {
        const list = document.getElementById('favoritesList');
        document.getElementById('favCount').textContent = `共 ${appData.favorites.length} 道收藏`;
        
        if (appData.favorites.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⭐</div><div>暂无收藏题目</div></div>';
            return;
        }

        list.innerHTML = '';
        const practiceBtn = document.createElement('button');
        practiceBtn.className = 'nav-btn primary';
        practiceBtn.style.marginBottom = '12px';
        practiceBtn.textContent = '练习全部收藏';
        practiceBtn.onclick = startFavoritePractice;
        list.appendChild(practiceBtn);

        appData.favorites.forEach(id => {
            const q = getQuestionById(id);
            if (!q) return;
            const item = document.createElement('div');
            item.className = 'question-list-item';
            item.onclick = () => {
                practiceState = {
                    questions: [q],
                    currentIndex: 0,
                    mode: 'single',
                    category: q.category,
                    userAnswers: {}
                };
                showView('practice');
                renderPracticeQuestion();
            };
            item.innerHTML = `
                <div class="question-list-stem">${escapeHtml(q.stem)}</div>
                <div class="question-list-meta">
                    <span>${q.category}</span>
                    <span>正确答案：${q.answer}</span>
                </div>
            `;
            list.appendChild(item);
        });
    }

    // ========== 统计 ==========
    function renderStats() {
        const total = window.QUESTIONS.length;
        const done = Object.keys(appData.progress).length;
        const correct = Object.values(appData.progress).filter(v => v === 'correct').length;
        const wrong = done - correct;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statDone').textContent = done;
        document.getElementById('statCorrect').textContent = correct;
        document.getElementById('statWrong').textContent = wrong;

        // 各分类统计
        const catStats = document.getElementById('categoryStats');
        catStats.innerHTML = '';
        Object.entries(window.QUESTION_CATEGORIES).forEach(([key, cat]) => {
            const catQuestions = getQuestionsByCategory(key);
            const catDone = catQuestions.filter(q => appData.progress[q.id]).length;
            const catCorrect = catQuestions.filter(q => appData.progress[q.id] === 'correct').length;
            const catAccuracy = catDone > 0 ? Math.round(catCorrect / catDone * 100) : 0;

            const item = document.createElement('div');
            item.className = 'category-stat-item';
            item.innerHTML = `
                <div class="category-stat-header">
                    <span class="category-stat-name">${cat.icon} ${cat.name}</span>
                    <span class="category-stat-rate">${catAccuracy}%</span>
                </div>
                <div class="category-stat-info">已做 ${catDone} / ${cat.count} 题 · 正确 ${catCorrect} · 错误 ${catDone - catCorrect}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${catDone/cat.count*100}%"></div>
                </div>
            `;
            catStats.appendChild(item);
        });

        // 考试历史
        const history = document.getElementById('examHistory');
        if (appData.examHistory.length === 0) {
            history.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div>暂无考试记录</div></div>';
        } else {
            history.innerHTML = '';
            appData.examHistory.forEach(record => {
                const item = document.createElement('div');
                item.className = 'exam-history-item';
                item.innerHTML = `
                    <div class="exam-history-info">
                        ${record.date}<br>
                        ${record.total}题 · 正确${record.correct} · 用时${formatTime(record.timeUsed)}
                    </div>
                    <div class="exam-history-score">${record.score}分</div>
                `;
                history.appendChild(item);
            });
        }
    }

    // ========== 工具函数 ==========
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== 初始化 ==========
    function init() {
        loadData();
        
        // 等待questions.js加载
        if (typeof window.QUESTIONS === 'undefined' || !window.QUESTIONS) {
            // 延迟初始化
            setTimeout(init, 100);
            return;
        }
        
        renderHome();
        console.log(`北森笔试刷题APP已加载，共 ${window.QUESTIONS.length} 道题`);
    }

    // 暴露全局函数
    window.showView = showView;
    window.startCategoryPractice = startCategoryPractice;
    window.startRandomPractice = startRandomPractice;
    window.startMockExam = startMockExam;
    window.startExam = startExam;
    window.submitExam = submitExam;
    window.showExamReview = showExamReview;
    window.restartExam = restartExam;
    window.prevQuestion = prevQuestion;
    window.nextQuestion = nextQuestion;
    window.exitPractice = exitPractice;
    window.toggleFavorite = toggleFavorite;
    window.toggleMemorizeMode = toggleMemorizeMode;
    window.startPaperPractice = startPaperPractice;
    window.examPrevQuestion = examPrevQuestion;
    window.examNextQuestion = examNextQuestion;
    window.jumpToExamQuestion = jumpToExamQuestion;

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
