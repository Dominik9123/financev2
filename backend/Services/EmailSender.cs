using MailKit.Net.Smtp;
using Microsoft.Extensions.Options;
using MimeKit;

namespace backend.Services
{
    public interface IEmailSender
    {
        Task SendEmailAsync(string email, string subject, string message);
    }

    public class EmailSender : IEmailSender
    {
        private readonly IOptions<SmtpOptions> _smtpOptions;

        public EmailSender(IOptions<SmtpOptions> smtpOptions)
        {
            _smtpOptions = smtpOptions;
        }

        public async Task SendEmailAsync(string email, string subject, string htmlMessage)
        {
            // SMTP is required only when sending mail, not for other account operations.
            var smtp = _smtpOptions.Value;
            var emailMessage = new MimeMessage();
            emailMessage.From.Add(new MailboxAddress(smtp.FromName, smtp.FromEmail));
            emailMessage.To.Add(new MailboxAddress("", email));
            emailMessage.Subject = subject;
            emailMessage.Body = new TextPart("html") { Text = htmlMessage };

            using (var client = new SmtpClient())
            {
                await client.ConnectAsync(smtp.Host, smtp.Port, MailKit.Security.SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(smtp.Username, smtp.Password);
                await client.SendAsync(emailMessage);
                await client.DisconnectAsync(true);
            }
        }
    }
}
