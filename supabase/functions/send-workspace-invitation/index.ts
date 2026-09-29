import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InvitationRequest {
  email: string;
  workspaceName: string;
  invitationUrl: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const body: InvitationRequest = await req.json();

    const { email, workspaceName, invitationUrl } = body;

    if (!email || !workspaceName || !invitationUrl) {
      return new Response(
        JSON.stringify({
          error:
            "email, workspaceName and invitationUrl are required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "MOM Creator <onboarding@resend.dev>",
          to: [email],
          subject: `You're invited to join ${workspaceName} on MOM Creator`,
          html: `
            <!DOCTYPE html>
            <html>
              <body
                style="
                  margin: 0;
                  padding: 0;
                  background: #f8fafc;
                  font-family: Arial, sans-serif;
                  color: #0f172a;
                "
              >
                <div
                  style="
                    max-width: 560px;
                    margin: 40px auto;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 32px;
                  "
                >
                  <h1
                    style="
                      margin: 0 0 12px;
                      font-size: 24px;
                    "
                  >
                    You're invited to MOM Creator
                  </h1>

                  <p
                    style="
                      font-size: 15px;
                      line-height: 1.6;
                      color: #475569;
                    "
                  >
                    You've been invited to join
                    <strong>${escapeHtml(workspaceName)}</strong>
                    as a workspace member.
                  </p>

                  <div style="margin: 28px 0;">
                    <a
                      href="${escapeHtml(invitationUrl)}"
                      style="
                        display: inline-block;
                        padding: 12px 20px;
                        background: #4f46e5;
                        color: white;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                      "
                    >
                      Accept Invitation
                    </a>
                  </div>

                  <p
                    style="
                      font-size: 13px;
                      line-height: 1.5;
                      color: #64748b;
                    "
                  >
                    This invitation expires in 7 days.
                  </p>

                  <p
                    style="
                      margin-top: 28px;
                      font-size: 12px;
                      color: #94a3b8;
                    "
                  >
                    If you weren't expecting this invitation,
                    you can safely ignore this email.
                  </p>
                </div>
              </body>
            </html>
          `,
        }),
      }
    );

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);

      return new Response(
        JSON.stringify({
          error: "Failed to send invitation email",
          details: resendData,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation email sent",
        emailId: resendData.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Invitation email error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}