interface MenuErrorProps {
  error: Error | null;
}

export function MenuError({ error }: MenuErrorProps) {
  return (
    <div className="container mx-auto p-4 text-center min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold text-red-600 mb-4">Erro ao Carregar Cardápio</h1>
      <p className="text-lg text-gray-700">Não foi possível carregar o cardápio. Por favor, tente novamente mais tarde.</p>
      {error && <p className="text-sm text-gray-500 mt-2">Detalhes: {error.message}</p>}
    </div>
  );
}
