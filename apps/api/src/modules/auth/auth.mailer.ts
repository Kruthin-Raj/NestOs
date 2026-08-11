import { mailTransporter } from '@config/mail'
import { env } from '@config/env'

export async function sendOtpEmail(email: string, otp: string) {
  await mailTransporter.sendMail({
    from: env.EMAIL_FROM,
    to: email,
    subject: 'Your NestOS verification code',
    text: `Your OTP is ${otp}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Email Verification</h2>
        <p>Your OTP is:</p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">
          ${otp}
        </div>
        <p>This OTP expires in ${env.OTP_EXPIRY_MINUTES} minutes.</p>
      </div>
    `,
  })
}