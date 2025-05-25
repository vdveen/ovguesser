import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Play, Share, X } from "lucide-react";

interface WinModalProps {
  stationName: string;
  finalDistance: number;
  attempts: number;
  onNewGame: () => void;
  onClose: () => void;
}

export default function WinModal({
  stationName,
  finalDistance,
  attempts,
  onNewGame,
  onClose,
}: WinModalProps) {
  const handleShare = async () => {
    const text = `Ik heb ${stationName} gevonden in ${attempts} pogingen en ${finalDistance}m op OVGuesser.nl! 🚂`;

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (error) {
        // Fallback to clipboard
        navigator.clipboard.writeText(text);
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[1001] p-4">
      <Card className="w-full max-w-md mx-auto shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-between items-start mb-2">
            <div></div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-8 h-8 text-emerald-600" />
          </div>

          <CardTitle className="text-2xl text-slate-900 mb-2">
            Uitstekend!
          </CardTitle>
          <p className="text-slate-600">
            Je hebt <span className="font-medium">{stationName}</span> gevonden
          </p>
        </CardHeader>

        <CardContent>
          <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Afstand:</span>
              <span className="font-bold text-emerald-600">
                {finalDistance}m
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Pogingen:</span>
              <span className="font-bold text-blue-600">{attempts}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={onNewGame}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Volgend Station
            </Button>

            <Button onClick={handleShare} variant="outline">
              <Share className="w-4 h-4 mr-2" />
              Deel Resultaat
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
