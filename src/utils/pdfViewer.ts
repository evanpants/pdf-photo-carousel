import { supabase } from "@/integrations/supabase/client";

/**
 * Opens a PDF in a new tab using the edge function proxy
 * This bypasses Chrome's blocking of direct Supabase storage URLs
 */
export async function viewPdfInNewTab(filePath: string): Promise<void> {
  try {
    console.log('Requesting PDF from edge function:', filePath);

    // Call the edge function to get the PDF
    const { data, error } = await supabase.functions.invoke('serve-pdf', {
      body: { filePath },
    });

    if (error) {
      console.error('Error fetching PDF:', error);
      throw new Error(`Failed to fetch PDF: ${error.message}`);
    }

    // Create a blob URL from the response
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Open in new tab
    const newWindow = window.open(url, '_blank');

    if (!newWindow) {
      throw new Error('Failed to open new window. Please check your popup blocker settings.');
    }

    // Clean up the blob URL after a delay to ensure it loads
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

  } catch (error) {
    console.error('Error viewing PDF:', error);
    throw error;
  }
}

/**
 * Downloads a PDF file
 */
export async function downloadPdf(filePath: string, fileName: string): Promise<void> {
  try {
    console.log('Downloading PDF:', filePath);

    const { data, error } = await supabase.functions.invoke('serve-pdf', {
      body: { filePath },
    });

    if (error) {
      console.error('Error downloading PDF:', error);
      throw new Error(`Failed to download PDF: ${error.message}`);
    }

    // Create a blob and trigger download
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
}
