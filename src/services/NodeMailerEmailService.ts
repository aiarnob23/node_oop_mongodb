import nodemailer, {
    type Transporter,
    type SendMailOptions,
    type SentMessageInfo,
} from 'nodemailer';
import { promises as fs } from 'fs';
import path from 'path';

// -----------------------------
// CONFIG INTERFACES
// -----------------------------

export interface NodeMailerConfig {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    defaultFromEmail?: string;
    defaultFromName?: string;
    templatePath?: string;
    maxRetries?: number;
    retryDelay?: number;
    enableTemplateCache?: boolean;
}

export interface EmailData {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    fromName?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string | string[];
}

export interface TemplatedEmailData extends Omit<EmailData, 'html' | 'text'> {
    templateData?: Record<string, any>;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
    to: string | string[];
}

export interface CompiledTemplate {
    html: string;
}

// -----------------------------
// SERVICE CLASS
// -----------------------------

export class NodeMailerEmailService {
    private transporter: Transporter;
    private defaultFrom: string;
    private defaultFromName: string;
    private templatePath: string;
    private maxRetries: number;
    private retryDelay: number;
    private templateCache: Map<string, string>;
    private enableTemplateCache: boolean;

    constructor(config: NodeMailerConfig = {}) {
        this.transporter = nodemailer.createTransport({
            host: config.host || process.env.SMTP_HOST,
            port: config.port || Number(process.env.SMTP_PORT) || 587,
            secure: config.secure ?? false,
            auth: {
                user: config.user || process.env.SMTP_USER,
                pass: config.pass || process.env.SMTP_PASS,
            },
        });

        this.defaultFrom = config.defaultFromEmail || process.env.DEFAULT_FROM_EMAIL || '';
        this.defaultFromName =
            config.defaultFromName || process.env.DEFAULT_FROM_NAME || '';

        this.templatePath =
            config.templatePath || path.resolve(process.cwd(), 'email-templates');

        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000;

        this.enableTemplateCache = config.enableTemplateCache !== false;
        this.templateCache = new Map();
    }

    // -----------------------------
    // PUBLIC METHODS
    // -----------------------------

    async sendEmail(emailData: EmailData): Promise<EmailResult> {
        try {
            const mailOptions = this.buildMailOptions(emailData);
            const result = await this.sendWithRetry(mailOptions);

            return {
                success: true,
                messageId: result.messageId,
                to: emailData.to,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                to: emailData.to,
            };
        }
    }

    async sendBulkEmails(
        recipients: string[],
        emailTemplate: Omit<EmailData, 'to'>
    ): Promise<EmailResult[]> {
        const results: EmailResult[] = [];

        for (const recipient of recipients) {
            const result = await this.sendEmail({
                ...emailTemplate,
                to: recipient,
            });

            results.push(result);
        }

        return results;
    }

    async sendTemplatedEmail(
        templateName: string,
        emailData: TemplatedEmailData
    ): Promise<EmailResult> {
        const template = await this.loadTemplate(templateName);
        const compiled = this.compileTemplate(template, emailData.templateData || {});

        return this.sendEmail({
            ...emailData,
            html: compiled.html,
        });
    }

    clearTemplateCache() {
        this.templateCache.clear();
    }

    // -----------------------------
    // PRIVATE METHODS
    // -----------------------------

    private buildMailOptions(emailData: EmailData): SendMailOptions {
        const fromAddress = emailData.from || this.defaultFrom;
        const displayName = emailData.fromName || this.defaultFromName;
        const fromHeader = displayName
            ? `"${displayName}" <${fromAddress}>`
            : fromAddress;

        return {
            from: fromHeader,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
            cc: emailData.cc,
            bcc: emailData.bcc,
            replyTo: emailData.replyTo,
        };
    }

    private async sendWithRetry(
        mailOptions: SendMailOptions
    ): Promise<SentMessageInfo> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.transporter.sendMail(mailOptions);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');

                if (attempt === this.maxRetries) {
                    throw lastError;
                }

                await new Promise(resolve =>
                    setTimeout(resolve, this.retryDelay * attempt)
                );
            }
        }

        throw lastError;
    }

    private async loadTemplate(templateName: string): Promise<string> {
        if (this.enableTemplateCache && this.templateCache.has(templateName)) {
            return this.templateCache.get(templateName)!;
        }

        const templatePath = path.join(this.templatePath, `${templateName}.html`);
        const template = await fs.readFile(templatePath, 'utf8');

        if (this.enableTemplateCache) {
            this.templateCache.set(templateName, template);
        }

        return template;
    }

    private compileTemplate(
        template: string,
        data: Record<string, any>
    ): CompiledTemplate {
        let compiled = template;

        Object.keys(data).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            compiled = compiled.replace(regex, String(data[key] || ''));
        });

        return { html: compiled };
    }
}