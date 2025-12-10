import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ProjectsList from "./pages/ProjectsList";
import Editor from "./pages/Editor";
import Preview from "./pages/Preview";
import PublicView from "./pages/PublicView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/projects" element={<ProjectsList />} />
          <Route path="/editor/:projectId" element={<Editor />} />
          <Route path="/preview/:projectId" element={<Preview />} />
          <Route path="/view/:slug" element={<PublicView />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
