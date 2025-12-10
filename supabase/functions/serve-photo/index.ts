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
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    if (
      typeof filePath !== 'string' ||
      filePath.includes('..') ||
      filePath.startsWith('/') ||
      filePath.includes('//') ||
      !validExtensions.includes(fileExtension)
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

    console.log('Attempting to download photo from path:', filePath, 'for user:', userId);

    // Authorization check: verify the user has access to this photo
    // First, find the photo record and get its region
    const { data: photo, error: photoError } = await supabaseAdmin
      .from('photos')
      .select('region_id')
      .eq('image_path', filePath)
      .maybeSingle();

    if (photoError) {
      console.error('Error finding photo:', photoError);
      return new Response(
        JSON.stringify({ error: 'Photo lookup failed' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!photo) {
      console.warn('Photo not found in database:', filePath);
      return new Response(
        JSON.stringify({ error: 'Photo not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the region to find the project
    const { data: region, error: regionError } = await supabaseAdmin
      .from('regions')
      .select('project_id')
      .eq('id', photo.region_id)
      .maybeSingle();

    if (regionError || !region) {
      console.error('Error finding region:', regionError);
      return new Response(
        JSON.stringify({ error: 'Region lookup failed' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the project to check ownership and published status
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('user_id, published')
      .eq('id', region.project_id)
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

    if (!project) {
      console.warn('Project not found for photo:', filePath);
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check access permissions
    const isOwner = userId && project.user_id === userId;
    const isPublished = project.published;

    if (!isOwner && !isPublished) {
      console.warn('Unauthorized photo access attempt:', filePath, 'by user:', userId);
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Download the photo from storage
    const { data, error } = await supabaseAdmin.storage
      .from('carousel-photos')
      .download(filePath);

    if (error) {
      console.error('Error downloading photo:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to download photo' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Photo not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Photo downloaded successfully, size:', data.size);

    // Determine content type based on extension
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = contentTypeMap[fileExtension] || 'application/octet-stream';

    // Return the photo with proper headers
    return new Response(data, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error in serve-photo function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
