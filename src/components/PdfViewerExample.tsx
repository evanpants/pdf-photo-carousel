import { Button } from "@/components/ui/button";
import { viewPdfInNewTab, downloadPdf } from "@/utils/pdfViewer";
import { toast } from "sonner";

/**
 * Example component showing how to use the PDF viewer utilities
 * Replace 'your-file-path.pdf' with the actual path to your PDF in Supabase Storage
 */
export const PdfViewerExample = () => {
  const handleViewPdf = async () => {
    try {
      // Replace with your actual PDF file path in storage
      await viewPdfInNewTab('your-file-path.pdf');
    } catch (error) {
      toast.error('Failed to open PDF', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleDownloadPdf = async () => {
    try {
      // Replace with your actual PDF file path and desired filename
      await downloadPdf('your-file-path.pdf', 'resume.pdf');
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.error('Failed to download PDF', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="flex gap-4">
      <Button onClick={handleViewPdf}>
        View PDF in New Tab
      </Button>
      <Button variant="outline" onClick={handleDownloadPdf}>
        Download PDF
      </Button>
    </div>
  );
};
