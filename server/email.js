import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_PORT !== '587',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendResetEmail(to, resetLink) {
  await transporter.sendMail({
    from:    `"Axoft × Сколково" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: 'Сброс пароля — Личный кабинет вендора',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e2849">Сброс пароля</h2>
        <p>Поступил запрос на сброс пароля для аккаунта <strong>${to}</strong>.</p>
        <p>
          <a href="${resetLink}"
             style="display:inline-block;padding:12px 24px;background:#00b0bd;
                    color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
            Задать новый пароль
          </a>
        </p>
        <p style="color:#6b7290;font-size:12px">
          Ссылка действует 1 час. Если вы не запрашивали сброс — просто проигнорируйте это письмо.
        </p>
      </div>
    `,
  });
}
