import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: 'File path is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Security: Validate filePath to prevent path traversal attacks
    if (
      typeof filePath !== 'string' ||
      filePath.includes('..') ||
      filePath.startsWith('/') ||
      filePath.includes('//') ||
      !filePath.toLowerCase().endsWith('.pdf')
    ) {
      console.error('Invalid file path attempted:', filePath);
      return new Response(
        JSON.stringify({ error: 'Invalid file path' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create service role client for file access
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the Authorization header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      // Create a client with the user's token to get their identity
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      userId = user?.id || null;
    }

    console.log('Attempting to download PDF from path:', filePath, 'for user:', userId);

    // Authorization check: verify the user has access to this PDF
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('user_id, published')
      .eq('pdf_path', filePath)
      .maybeSingle();

    if (projectError) {
      console.error('Error checking project authorization:', projectError);
      return new Response(
        JSON.stringify({ error: 'Authorization check failed' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If project exists, check access permissions
    if (project) {
      const isOwner = userId && project.user_id === userId;
      const isPublished = project.published;

      if (!isOwner && !isPublished) {
        console.warn('Unauthorized PDF access attempt:', filePath, 'by user:', userId);
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else {
      // PDF not associated with any project - deny access for security
      console.warn('PDF not found in any project:', filePath);
      return new Response(
        JSON.stringify({ error: 'PDF not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Download the PDF from storage
    const { data, error } = await supabaseAdmin.storage
      .from('pdfs')
      .download(filePath);

    if (error) {
      console.error('Error downloading PDF:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to download PDF', details: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'PDF not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('PDF downloaded successfully, size:', data.size);

    // Return the PDF with proper headers
    return new Response(data, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error in serve-pdf function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
