interface MenuNotFoundProps {
    menuId: string | undefined;
}

export function MenuNotFound({ menuId }: MenuNotFoundProps) {
    return (
        <div className="container mx-auto p-4 text-center min-h-screen flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Cardápio Não Encontrado</h1>
            <p className="text-lg text-gray-700">O cardápio com o ID "{menuId}" não foi encontrado ou não está disponível.</p>
        </div>
    );
}
