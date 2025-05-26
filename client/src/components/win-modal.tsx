import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Play, X, Share } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WinModalProps {
  stationName: string;
  finalDistance: number;
  attempts: number;
  roundScore?: number;
  onNewGame: () => void;
  onClose: () => void;
}

interface SessionCompleteModalProps {
  totalAttempts: number;
  totalDistance: number;
  totalScore: number;
  gamesCompleted: number;
  onNewSession: () => void;
  onClose: () => void;
}

export function SessionCompleteModal({
  totalAttempts,
  totalDistance,
  totalScore,
  gamesCompleted,
  onNewSession,
  onClose,
}: SessionCompleteModalProps) {
  const { toast } = useToast();
  const averageAttempts = (totalAttempts / gamesCompleted).toFixed(1);
  const averageScore = Math.round(totalScore / gamesCompleted);

  const handleShare = async () => {
    const text = `Ik heb ${totalScore.toLocaleString()} punten gehaald op OVGuesser.nl! 🚂`;

    // Check if Web Share API is available and supported
    if (navigator.share && navigator.canShare && navigator.canShare({ text })) {
      try {
        await navigator.share({ text });
        return; // Successfully shared, no need for toast
      } catch (error) {
        // User cancelled or sharing failed, fall through to clipboard
      }
    }

    // Fallback to clipboard (for desktop browsers or when sharing fails/is cancelled)
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Gekopieerd!",
        description: "Je resultaat is gekopieerd naar het klembord.",
      });
    } catch (error) {
      // Clipboard API not available, try older method
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        toast({
          title: "Gekopieerd!",
          description: "Je resultaat is gekopieerd naar het klembord.",
        });
      } catch (fallbackError) {
        toast({
          title: "Fout",
          description:
            "Kon het resultaat niet kopiëren. Probeer het handmatig te kopiëren.",
        });
      }
      document.body.removeChild(textArea);
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

          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-8 h-8 text-blue-600" />
          </div>

          <CardTitle className="text-2xl text-slate-900 mb-2">
            Goed gedaan!
          </CardTitle>
          <p className="text-slate-600">
            Je hebt {totalScore.toLocaleString()} punten gehaald
          </p>
        </CardHeader>

        <CardContent>
          <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Totaal score:</span>
              <span className="font-bold text-purple-600 text-lg">
                {totalScore.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Gem. score:</span>
              <span className="font-bold text-purple-500">
                {averageScore.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Totale pogingen:</span>
              <span className="font-bold text-blue-600">{totalAttempts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Totale afstand:</span>
              <span className="font-bold text-red-600">
                {Math.round(totalDistance / 1000)}km
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Gem. pogingen:</span>
              <span className="font-bold text-emerald-600">
                {averageAttempts}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Gem. afstand:</span>
              <span className="font-bold text-orange-600">
                {Math.round(totalDistance / gamesCompleted / 1000)}km
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={onNewSession}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Nieuwe Sessie Starten
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

export default function WinModal({
  stationName,
  finalDistance,
  attempts,
  roundScore,
  onNewGame,
  onClose,
}: WinModalProps) {
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
            {roundScore !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Ronde Score:</span>
                <span className="font-bold text-purple-600">
                  {roundScore.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={onNewGame}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Volgend Station
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
