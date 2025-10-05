'use client'

interface PokemonEntry {
  name: string
  image: string
  type1: string
  type2?: string
  size?: string
  link?: boolean
  fir?: string
  status?: string
}

interface PokemonTableProps {
  title: string
  pokemon: PokemonEntry[]
}

export default function PokemonTable({ title, pokemon }: PokemonTableProps) {
  return (
    <div className="pokemon-table">
      <h4 className="text-xs font-bold mb-2">{title}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {pokemon.map((pkmn, index) => (
          <div key={index} className="text-center">
            <div className="border border-gray-300 rounded-md p-2 bg-gray-50">
              <img 
                src={pkmn.image} 
                alt={pkmn.name}
                className="w-16 h-16 object-contain mx-auto"
                style={{ 
                  width: pkmn.size ? `${parseInt(pkmn.size) * 0.7}px` : '64px'
                }}
              />
              <div className="mt-1 text-[10px]">
                <strong className="block">{pkmn.name}</strong>
                <span className="text-gray-600">
                  {pkmn.type1}{pkmn.type2 ? ` / ${pkmn.type2}` : ''}
                </span>
                {pkmn.fir && (
                  <div className="text-[9px] text-gray-500">
                    (formerly {pkmn.fir})
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
