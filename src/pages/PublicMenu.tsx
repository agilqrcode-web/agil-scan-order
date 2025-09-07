import React from 'react';
import { useParams } from 'react-router-dom';

export default function PublicMenu() {
  const { menuId } = useParams();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold text-center mb-8">Cardápio Público</h1>
      <div className="shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Detalhes do Cardápio (ID: {menuId})</h2>
        <p className="text-lg">Este é um cardápio de exemplo com dados estáticos.</p>
        <div className="mt-6">
          <h3 className="text-xl font-bold mb-3">Categorias</h3>
          <ul className="list-disc list-inside">
            <li className="mb-2">
              <span className="font-semibold">Entradas</span>
              <ul className="list-circle list-inside ml-4">
                <li>Pão de Alho com Queijo - R$ 15,00</li>
                <li>Batata Frita com Cheddar e Bacon - R$ 25,00</li>
              </ul>
            </li>
            <li className="mb-2">
              <span className="font-semibold">Pratos Principais</span>
              <ul className="list-circle list-inside ml-4">
                <li>Bife à Parmegiana - R$ 45,00</li>
                <li>Salmão Grelhado com Legumes - R$ 55,00</li>
              </ul>
            </li>
            <li className="mb-2">
              <span className="font-semibold">Bebidas</span>
              <ul className="list-circle list-inside ml-4">
                <li>Refrigerante - R$ 7,00</li>
                <li>Suco Natural - R$ 10,00</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
