
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import QRCode from "react-qr-code";
import QRCodeGenerator from 'qrcode';
import jsPDF from "jspdf";
import { Download } from "lucide-react";

interface QrCodeModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  table: { qr_code_identifier: string; table_number: number } | null;
  restaurantName: string | null;
  activeMenuId: string | null;
}

export function QrCodeModal({ isOpen, onOpenChange, table, restaurantName, activeMenuId }: QrCodeModalProps) {
  if (!table) return null;

  const qrCodeValue = activeMenuId ? `https://agil-scan-order-neon.vercel.app/menus/${activeMenuId}?table=${table.qr_code_identifier}` : '';

  const handleDownloadPdf = async () => {
    if (!qrCodeValue) return;

    const instructionsText = 'Aponte a câmera do seu celular para este QR Code para acessar o cardápio digital e fazer seu pedido.';
    const qrCodeCanvas = document.createElement('canvas');
    const qrCodeSize = 200;
    qrCodeCanvas.width = qrCodeSize;
    qrCodeCanvas.height = qrCodeSize;

    await new Promise<void>((resolve, reject) => {
      QRCodeGenerator.toCanvas(qrCodeCanvas, qrCodeValue, {
        width: qrCodeSize,
        margin: 1,
        color: { dark: '#000000FF', light: '#FFFFFFFF' }
      }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const qrCodeDataUrl = qrCodeCanvas.toDataURL('image/png');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let yOffset = 20;

    const qrCodeImageWidth = 50;
    const qrCodeImageHeight = 50;
    const qrCodeX = (pageWidth - qrCodeImageWidth) / 2;
    doc.addImage(qrCodeDataUrl, 'PNG', qrCodeX, yOffset, qrCodeImageWidth, qrCodeImageHeight);
    yOffset += qrCodeImageHeight + 5;

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(qrCodeValue, pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 10;

    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text(restaurantName || 'Nome do Restaurante', pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 10;

    doc.setFontSize(14);
    doc.text(`Mesa ${table.table_number}`, pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 15;

    doc.setFontSize(10);
    const splitInstructions = doc.splitTextToSize(instructionsText, pageWidth - 40);
    doc.text(splitInstructions, pageWidth / 2, yOffset, { align: 'center' });

    doc.save(`mesa-${table.table_number}.pdf`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] flex flex-col items-center">
        <DialogHeader>
          <DialogTitle>QR Code da Mesa {table.table_number}</DialogTitle>
          <DialogDescription>
            Este QR Code deve ficar visível para seus clientes.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 border border-gray-200 rounded-lg">
          <QRCode
            value={qrCodeValue}
            size={256}
            level="H"
            includeMargin={true}
          />
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleDownloadPdf}>
            <Download className="mr-2 h-4 w-4" />
            Baixar QR Code
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
