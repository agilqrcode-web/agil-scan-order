
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface TablesHeaderProps {
  onAddTable: () => void;
}

export function TablesHeader({ onAddTable }: TablesHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold">Mesas</h1>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onAddTable}>
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Adicionar Mesa</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Adicionar Mesa</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
