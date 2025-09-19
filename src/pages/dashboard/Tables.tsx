
import { useState } from "react";
import { useTables, AddTableFormValues } from "@/hooks/useTables";
import { TablesHeader } from "@/components/dashboard/tables/TablesHeader";
import { TableStats } from "@/components/dashboard/tables/TableStats";
import { TableList } from "@/components/dashboard/tables/TableList";
import { AddTableModal } from "@/components/dashboard/tables/AddTableModal";
import { QrCodeModal } from "@/components/dashboard/tables/QrCodeModal";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export default function Tables() {
  const {
    restaurantName,
    activeMenuId,
    tableCounts,
    tables,
    existingTableNumbers,
    loading,
    error,
    addTable,
    deleteTable,
  } = useTables();

  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  
  const [selectedTableQr, setSelectedTableQr] = useState<{ qr_code_identifier: string; table_number: number } | null>(null);
  const [tableToDeleteId, setTableToDeleteId] = useState<string | null>(null);

  const handleAddTable = async (values: AddTableFormValues) => {
    const promise = addTable(values).then(() => {
        setIsAddTableModalOpen(false);
    });

    toast.promise(promise, {
        loading: 'Adicionando mesa...',
        success: 'Mesa adicionada com sucesso!',
        error: (err) => err.message || 'Falha ao adicionar mesa.',
    });
  };

  const handleDelete = (tableId: string) => {
    setTableToDeleteId(tableId);
    setIsDeleteConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!tableToDeleteId) return;

    const promise = deleteTable(tableToDeleteId).then(() => {
        setIsDeleteConfirmModalOpen(false);
        setTableToDeleteId(null);
    });

    toast.promise(promise, {
        loading: 'Excluindo mesa...',
        success: 'Mesa excluída com sucesso!',
        error: (err) => err.message || 'Falha ao excluir mesa.',
    });
  };

  const handleShowQrCode = (table: { qr_code_identifier: string; table_number: number }) => {
    setSelectedTableQr(table);
    setIsQrCodeModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <Toaster richColors />
      <TablesHeader onAddTable={() => setIsAddTableModalOpen(true)} />

      <TableStats counts={tableCounts} loading={loading} error={error} />

      <TableList
        tables={tables}
        loading={loading}
        error={error}
        onShowQrCode={handleShowQrCode}
        onDelete={handleDelete}
      />

      <AddTableModal
        isOpen={isAddTableModalOpen}
        onOpenChange={setIsAddTableModalOpen}
        onSubmit={handleAddTable}
        existingTableNumbers={existingTableNumbers}
      />

      <QrCodeModal
        isOpen={isQrCodeModalOpen}
        onOpenChange={setIsQrCodeModalOpen}
        table={selectedTableQr}
        restaurantName={restaurantName}
        activeMenuId={activeMenuId}
      />

      <ConfirmationDialog
        isOpen={isDeleteConfirmModalOpen}
        onOpenChange={setIsDeleteConfirmModalOpen}
        onConfirm={confirmDelete}
        title="Tem certeza?"
        description="Esta ação não pode ser desfeita. Isso excluirá permanentemente a mesa e todos os dados associados a ela."
        confirmText="Excluir"
      />
    </div>
  );
}
