import * as nodemailer from 'nodemailer'
import { env } from '@config/env'

export const mailTransporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: Number(env.EMAIL_PORT),
  secure: env.EMAIL_SECURE === 'true',
  auth: {
    user: env.EMAIL_USER,   
    pass: env.EMAIL_PASSWORD,
  },
})