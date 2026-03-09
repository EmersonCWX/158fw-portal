// @ts-ignore — Deno URL imports are not resolvable by the VS Code TS server
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Deno global declarations (runtime is Deno; VS Code TS server doesn't know about it)
declare const Deno: {
    serve: (handler: (req: Request) => Promise<Response> | Response) => void;
    env: { get: (key: string) => string | undefined };
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Admin client uses the service role key (available to Edge Functions securely)
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        // Verify the calling user is authenticated
        const callerClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user }, error: authError } = await callerClient.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Verify the caller is a registered admin
        const { data: adminRow } = await adminClient
            .from('vsaferep_admins')
            .select('email')
            .eq('email', user.email)
            .maybeSingle();

        if (!adminRow) {
            return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse request body
        const { email, callsign, name } = await req.json();
        if (!email || !callsign) {
            return new Response(JSON.stringify({ error: 'email and callsign are required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const siteUrl = Deno.env.get('SITE_URL') ?? 'https://virtual158th.com';

        // Create the user immediately in Supabase Auth (no invite link needed)
        // A random password is set — they will reset it via the email we send below
        const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
        const tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(24)))
            .map(b => charset[b % charset.length])
            .join('');

        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
            email,
            email_confirm: true,   // mark email as confirmed straight away
            password: tempPassword,
            user_metadata: {
                callsign:    callsign.toUpperCase(),
                real_name:   name || '',
                needs_setup: true,  // site detects this and shows the setup modal
            },
        });

        if (createError) {
            return new Response(JSON.stringify({ error: createError.message }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Send a "set your password" email via Supabase's built-in reset flow
        // User clicks the link → lands on the site → setup modal appears
        const anonClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        );
        const { error: resetError } = await anonClient.auth.resetPasswordForEmail(email, {
            redirectTo: siteUrl,
        });

        if (resetError) {
            // User was created successfully — just log the email failure
            console.error('Password reset email failed:', resetError.message);
        }

        return new Response(
            JSON.stringify({ success: true, userId: created.user?.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
