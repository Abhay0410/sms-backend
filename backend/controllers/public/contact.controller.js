import { Resend } from 'resend';
import { successResponse } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError } from '../../utils/errors.js';

export const submitContactForm = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    throw new ValidationError("All fields are required");
  }

  // Initialize Resend with your API key
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'EduZager System <onboarding@resend.dev>', // Use onboarding@resend.dev for testing
      to: process.env.SUPPORT_EMAIL || 'support@eduzager.com', 
      reply_to: email, // This allows you to click "Reply" in your email client and reply directly to the user!
      subject: `Website Contact: ${subject}`,
      html: `
        <h2>New Contact Request from EduZager Website</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br/>${message}</p>
      `
    });

    return successResponse(res, "Message sent successfully");
  } catch (error) {
    throw new Error("Failed to send email. Please try again later.");
  }
});
