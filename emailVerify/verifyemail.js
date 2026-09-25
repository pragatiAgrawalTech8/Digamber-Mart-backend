import nodemailer from "nodemailer";
import "dotenv/config";

export const verifyEmail = async (token, email) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const verifyLink = `${
      process.env.FRONTEND_URL || "https://www.digambermart.com"
    }/verify/${token}`;

    const mailConfigurations = {
      from: process.env.MAIL_USER,
      to: email,
      subject: "Email Verification - Digamber Mart",
      html: `
        <h2>Welcome to Digamber Mart!</h2>
        <p>Please click the link below to verify your email:</p>
        <a href="${verifyLink}" 
           style="background:#DB2777;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
          Verify Email
        </a>
        <p>Or copy this link: ${verifyLink}</p>
        <p>This link expires in 10 minutes.</p>
      `,
    };

    const info = await transporter.sendMail(mailConfigurations);
    console.log("✅ Email Sent Successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email Send Failed:", error.message);
    return null; // Don't throw — server crash na ho
  }
};