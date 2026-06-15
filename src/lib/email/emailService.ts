import { logger } from "@/lib/logging/logger";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmailWithRetry(
  options: EmailOptions,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "noreply@psychologist.local",
          to: options.to,
          subject: options.subject,
          html: options.html,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Resend API error: ${error.message}`);
      }

      return { success: true };
    } catch (error) {
      lastError = error as Error;
      const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const errorMsg = lastError?.message || "Unknown error";
  logger.error("[email] Failed to send email after retries", lastError as Error, {
    to: options.to,
    subject: options.subject,
    attempts: maxRetries,
  });

  return { success: false, error: errorMsg };
}

function getVerificationEmailTemplate(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding-bottom: 20px; }
          .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f0f0f0; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Verify Your Email</h2>
          </div>
          <p>Thank you for signing up! Use this code to verify your email address:</p>
          <div class="code">${code}</div>
          <p>This code expires in 15 minutes.</p>
          <p>If you didn't sign up, you can safely ignore this email.</p>
          <div class="footer">
            <p>Personal Psychologist™ | Privacy-First Psychology Coaching</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getPasswordResetEmailTemplate(resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding-bottom: 20px; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; text-align: center; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Reset Your Password</h2>
          </div>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </div>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <div class="footer">
            <p>Personal Psychologist™ | Privacy-First Psychology Coaching</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getWelcomeEmailTemplate(name?: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding-bottom: 20px; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Welcome to Personal Psychologist!</h2>
          </div>
          <p>Hello${name ? ` ${name}` : ""}!</p>
          <p>Your account has been successfully created. You're now ready to start your psychology coaching journey.</p>
          <p>Our platform is designed with your privacy in mind. All your conversations are encrypted and never shared without your explicit consent.</p>
          <p>Get started by logging in and creating your first session.</p>
          <div class="footer">
            <p>Personal Psychologist™ | Privacy-First Psychology Coaching</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmailWithRetry({
    to: email,
    subject: "Verify Your Email - Personal Psychologist",
    html: getVerificationEmailTemplate(code),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  baseUrl: string = process.env.NEXTAUTH_URL || "http://localhost:3000"
): Promise<{ success: boolean; error?: string }> {
  const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
  return sendEmailWithRetry({
    to: email,
    subject: "Reset Your Password - Personal Psychologist",
    html: getPasswordResetEmailTemplate(resetLink),
  });
}

export async function sendWelcomeEmail(
  email: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmailWithRetry({
    to: email,
    subject: "Welcome to Personal Psychologist",
    html: getWelcomeEmailTemplate(name),
  });
}
