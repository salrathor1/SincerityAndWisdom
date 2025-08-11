import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Heart, Mail, ExternalLink } from "lucide-react";

export function SupportRibbon() {
  const [isVisible, setIsVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed the ribbon
    const dismissed = localStorage.getItem('supportRibbonDismissed');
    if (!dismissed) {
      // Show the ribbon after a short delay
      setTimeout(() => {
        setIsVisible(true);
      }, 2000);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('supportRibbonDismissed', 'true');
  };

  const handleSupportClick = () => {
    setShowModal(true);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Support Ribbon */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg border-t-2 border-green-500">
        <div className="flex items-center justify-between px-4 py-3 max-w-6xl mx-auto">
          <div className="flex items-center space-x-3">
            <Heart className="h-5 w-5 text-green-200" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Support Our Islamic Educational Project
              </p>
              <p className="text-xs text-green-100">
                Help us improve transcriptions and translations
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleSupportClick}
              size="sm"
              variant="secondary"
              className="bg-white text-green-700 hover:bg-green-50"
            >
              Learn More
            </Button>
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="ghost"
              className="text-white hover:bg-green-800 p-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Support Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-green-600" />
              <span>Support the Project</span>
            </DialogTitle>
            <DialogDescription>
              Help us continue improving Islamic educational content
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="text-sm text-gray-600 space-y-3">
              <p>
                If you are able to check Arabic transcriptions, translate accurately, 
                design images or have any other skills or ideas please contact us.
              </p>
              
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                <Mail className="h-4 w-4 text-gray-500" />
                <a 
                  href="mailto:sincerityandwisdom@gmail.com" 
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  sincerityandwisdom@gmail.com
                </a>
              </div>
              
              <p>
                If you would like to financially support projects I am working on 
                please donate using the link below:
              </p>
              
              <div className="p-3 bg-green-50 rounded-lg">
                <a
                  href="https://www.launchgood.com/v4/campaign/help_benefit_the_muslim_ummah?src=2416469"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-green-700 hover:text-green-900 font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Donate via LaunchGood</span>
                </a>
              </div>
              
              <p className="text-xs text-gray-500">
                I intend to always keep part of the project free, but may add monetised 
                elements in the future as I believe projects should be as self-sufficient as possible.
              </p>
              
              <p className="text-center font-medium text-green-700">
                JazaakumAllah Khair
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}