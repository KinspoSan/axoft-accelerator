// js/auth-init.js — подключается только в index.html
import Auth from './auth.js';

if (Auth.isLoggedIn()) {
  window.location.href = 'cabinet.html';
}

window.showTab = function(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('form-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
};

['l-email','l-password','r-company','r-inn','r-email','r-password','r-password2']
  .forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      document.getElementById('login-error').classList.remove('show');
      document.getElementById('reg-error').classList.remove('show');
    });
  });

// ── РЕГИСТРАЦИЯ ───────────────────────────────────────────────────────────────
document.getElementById('btn-register').addEventListener('click', async () => {
  const btn   = document.getElementById('btn-register');
  const errEl = document.getElementById('reg-error');
  errEl.classList.remove('show');

  const company   = document.getElementById('r-company').value.trim();
  const inn       = document.getElementById('r-inn').value.trim();
  const direction = document.getElementById('r-direction').value;
  const stage     = document.getElementById('r-stage').value;
  const skolkovo  = document.getElementById('r-skolkovo').checked;
  const email     = document.getElementById('r-email').value.trim().toLowerCase();
  const password  = document.getElementById('r-password').value;
  const password2 = document.getElementById('r-password2').value;

  if (!company || !inn || !direction || !stage || !email || !password) {
    errEl.textContent = 'Заполните все обязательные поля.';
    errEl.classList.add('show');
    return;
  }
  if (!/^\d{10}$/.test(inn)) {
    errEl.textContent = 'ИНН организации должен содержать ровно 10 цифр.';
    errEl.classList.add('show');
    return;
  }
  if (password.length < 8) {
    errEl.textContent = 'Пароль должен быть не менее 8 символов.';
    errEl.classList.add('show');
    return;
  }
  if (password !== password2) {
    errEl.textContent = 'Пароли не совпадают.';
    errEl.classList.add('show');
    return;
  }

  btn.textContent = 'Регистрируем...';
  btn.disabled = true;

  try {
    await Auth.register({ company, inn, direction, stage, skolkovo, email, password });
    window.location.href = 'cabinet.html';
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.add('show');
    btn.textContent = 'Зарегистрировать компанию';
    btn.disabled = false;
  }
});

// ── ВХОД ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  const btn   = document.getElementById('btn-login');
  const errEl = document.getElementById('login-error');
  errEl.classList.remove('show');

  const email    = document.getElementById('l-email').value.trim().toLowerCase();
  const password = document.getElementById('l-password').value;

  if (!email || !password) {
    errEl.textContent = 'Введите email и пароль.';
    errEl.classList.add('show');
    return;
  }

  btn.textContent = 'Входим...';
  btn.disabled = true;

  try {
    await Auth.login(email, password);
    window.location.href = 'cabinet.html';
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.add('show');
    btn.textContent = 'Войти в кабинет';
    btn.disabled = false;
  }
});
