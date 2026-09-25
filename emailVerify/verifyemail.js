import { Resend } from "resend";
import "dotenv/config";

const resend = new Resend(process.env.RESEND_API_KEY);

export const verifyEmail = async (token, email) => {
  try {
    console.log("📧 Sending email via Resend to:", email);

    const verifyLink = `${
      process.env.FRONTEND_URL || "https://www.digambermart.com"
    }/verify/${token}`;

    const { data, error } = await resend.emails.send({
      from: "Digamber Mart <onboarding@resend.dev>",   // Free tier pe ye use karo
      to: email,
      subject: "Email Verification - Digamber Mart",
      html: `
        <h2>Welcome to Digamber Mart!</h2>
        <p>Click below to verify:</p>
        <a href="${verifyLink}" style="background:#DB2777;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
          Verify Email
        </a>
        <p>Or copy: ${verifyLink}</p>
        <p>Link expires in 10 minutes.</p>
      `,
    });

    if (error) {
      console.error("❌ Resend error:", error);
      return null;
    }

    console.log("✅ Email Sent Successfully:", data.id);
    return data;
  } catch (error) {
    console.error("❌ Email Send Failed:", error.message);
    return null;
  }
};