let currentUser = null;
let currentProject = null;
let projects = [];

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    checkAuthStatus();
}

function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('showRegister').addEventListener('click', showRegisterForm);
    document.getElementById('showLogin').addEventListener('click', showLoginForm);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    document.getElementById('projectForm').addEventListener('submit', handleCreateProject);
    document.getElementById('dailyReportForm').addEventListener('submit', handleCreateReport);
    document.getElementById('editProjectForm').addEventListener('submit', handleEditProject);
    
    document.getElementById('refreshProjects').addEventListener('click', loadProjects);
    document.getElementById('projectSelect').addEventListener('change', handleProjectSelect);
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    document.querySelector('.close').addEventListener('click', closeModal);
    
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('projectModal');
        if (event.target === modal) {
            closeModal();
        }
    });
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reportDate').value = today;
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            showMainApp();
            loadProjects();
        } else {
            showLoginForm();
        }
    } catch (error) {
        console.error('認証状態確認エラー:', error);
        showLoginForm();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            showAlert('ログインしました', 'success');
            showMainApp();
            loadProjects();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('ログインエラー:', error);
        showAlert('ログインに失敗しました', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('ユーザー登録が完了しました。ログインしてください。', 'success');
            showLoginForm();
            document.getElementById('registerForm').reset();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('登録エラー:', error);
        showAlert('ユーザー登録に失敗しました', 'error');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        projects = [];
        showLoginForm();
        showAlert('ログアウトしました', 'success');
    } catch (error) {
        console.error('ログアウトエラー:', error);
    }
}

function showLoginForm() {
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('registerContainer').style.display = 'block';
    document.getElementById('mainContainer').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'block';
    document.getElementById('currentUser').textContent = `${currentUser.username}さん`;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'reports') {
        loadProjectsForSelect();
    }
}

async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        if (response.ok) {
            projects = await response.json();
            displayProjects();
        } else {
            showAlert('プロジェクトの読み込みに失敗しました', 'error');
        }
    } catch (error) {
        console.error('プロジェクト読み込みエラー:', error);
        showAlert('プロジェクトの読み込みに失敗しました', 'error');
    }
}

function displayProjects() {
    const projectsList = document.getElementById('projectsList');
    
    if (projects.length === 0) {
        projectsList.innerHTML = '<p>プロジェクトがありません。新規作成してください。</p>';
        return;
    }
    
    projectsList.innerHTML = projects.map(project => `
        <div class="project-item" onclick="openProjectModal(${project.id})">
            <div class="project-header">
                <h3 class="project-name">${project.name}</h3>
                <span class="project-status status-${project.status}">${getStatusText(project.status)}</span>
            </div>
            <p class="project-description">${project.description || '説明なし'}</p>
            <div class="project-meta">
                作成者: ${project.created_by_name} | 
                作成日: ${formatDate(project.created_at)} | 
                更新日: ${formatDate(project.updated_at)}
            </div>
        </div>
    `).join('');
}

function getStatusText(status) {
    const statusMap = {
        'planning': '企画中',
        'in-progress': '進行中',
        'testing': 'テスト中',
        'completed': '完了',
        'on-hold': '保留'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
}

async function handleCreateProject(e) {
    e.preventDefault();
    
    const name = document.getElementById('projectName').value;
    const description = document.getElementById('projectDescription').value;
    const status = document.getElementById('projectStatus').value;
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description, status })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('プロジェクトを作成しました', 'success');
            document.getElementById('projectForm').reset();
            loadProjects();
            switchTab('projects');
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('プロジェクト作成エラー:', error);
        showAlert('プロジェクトの作成に失敗しました', 'error');
    }
}

function openProjectModal(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    currentProject = project;
    
    document.getElementById('modalProjectName').textContent = project.name;
    document.getElementById('editProjectName').value = project.name;
    document.getElementById('editProjectDescription').value = project.description || '';
    document.getElementById('editProjectStatus').value = project.status;
    
    document.getElementById('projectModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('projectModal').style.display = 'none';
    currentProject = null;
}

async function handleEditProject(e) {
    e.preventDefault();
    
    if (!currentProject) return;
    
    const name = document.getElementById('editProjectName').value;
    const description = document.getElementById('editProjectDescription').value;
    const status = document.getElementById('editProjectStatus').value;
    
    try {
        const response = await fetch(`/api/projects/${currentProject.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description, status })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('プロジェクトを更新しました', 'success');
            closeModal();
            loadProjects();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('プロジェクト更新エラー:', error);
        showAlert('プロジェクトの更新に失敗しました', 'error');
    }
}

async function loadProjectsForSelect() {
    const select = document.getElementById('projectSelect');
    select.innerHTML = '<option value="">プロジェクトを選択</option>';
    
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        select.appendChild(option);
    });
}

function handleProjectSelect() {
    const projectId = document.getElementById('projectSelect').value;
    const reportForm = document.getElementById('reportForm');
    
    if (projectId) {
        reportForm.style.display = 'block';
        loadReports(projectId);
    } else {
        reportForm.style.display = 'none';
        document.getElementById('reportsList').innerHTML = '';
    }
}

async function loadReports(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/reports`);
        if (response.ok) {
            const reports = await response.json();
            displayReports(reports);
        } else {
            showAlert('日報の読み込みに失敗しました', 'error');
        }
    } catch (error) {
        console.error('日報読み込みエラー:', error);
        showAlert('日報の読み込みに失敗しました', 'error');
    }
}

function displayReports(reports) {
    const reportsList = document.getElementById('reportsList');
    
    if (reports.length === 0) {
        reportsList.innerHTML = '<div class="card"><p>まだ日報がありません。</p></div>';
        return;
    }
    
    reportsList.innerHTML = reports.map(report => `
        <div class="report-item">
            <div class="report-header">
                <span class="report-date">${formatDate(report.date)}</span>
                <div>
                    <span class="report-progress">${report.progress_percentage}%</span>
                    <span style="margin-left: 10px; color: #7f8c8d;">${report.username}</span>
                </div>
            </div>
            <div class="report-content">${report.content}</div>
        </div>
    `).join('');
}

async function handleCreateReport(e) {
    e.preventDefault();
    
    const projectId = document.getElementById('projectSelect').value;
    const date = document.getElementById('reportDate').value;
    const content = document.getElementById('reportContent').value;
    const progress_percentage = document.getElementById('progressPercentage').value;
    
    try {
        const response = await fetch(`/api/projects/${projectId}/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date, content, progress_percentage })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('日報を投稿しました', 'success');
            document.getElementById('dailyReportForm').reset();
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('reportDate').value = today;
            loadReports(projectId);
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('日報投稿エラー:', error);
        showAlert('日報の投稿に失敗しました', 'error');
    }
}

function showAlert(message, type) {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(alert, container.firstChild);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}