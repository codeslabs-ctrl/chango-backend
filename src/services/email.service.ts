import nodemailer from 'nodemailer';
import { SMTP_CONFIG } from '../config/env';

const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_CONFIG.user;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if ((!SMTP_CONFIG.service && !SMTP_CONFIG.host) || !SMTP_CONFIG.user || !SMTP_CONFIG.pass) {
    return null;
  }
  const options: Record<string, unknown> = {
    auth: {
      user: SMTP_CONFIG.user,
      pass: SMTP_CONFIG.pass
    }
  };
  if (SMTP_CONFIG.service) {
    options.service = SMTP_CONFIG.service;
  } else {
    options.host = SMTP_CONFIG.host;
    options.port = SMTP_CONFIG.port;
    options.secure = SMTP_CONFIG.secure;
  }
  transporter = nodemailer.createTransport(options as nodemailer.TransportOptions);
  return transporter;
}

export async function sendOtpEmail(to: string, otp: string): Promise<boolean> {
  const trans = getTransporter();
  if (!trans) {
    console.log('[Email] SMTP no configurado. OTP (para pruebas):', otp);
    return false;
  }
  try {
    await trans.sendMail({
      from: EMAIL_FROM || SMTP_CONFIG.user,
      to,
      subject: 'Recuperar contraseña - Santa Barbara de Chango',
      html: `
        <p>Has solicitado recuperar tu contraseña.</p>
        <p>Tu clave temporal es: <strong>${otp}</strong></p>
        <p>Usa esta clave junto con tu usuario para iniciar sesión. El sistema te pedirá cambiar la contraseña.</p>
        <p>Si no solicitaste este cambio, ignora este correo.</p>
      `
    });
    return true;
  } catch (err) {
    console.error('[Email] Error al enviar:', err);
    return false;
  }
}
