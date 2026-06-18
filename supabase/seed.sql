-- ============================================================
-- Seed de démonstration — bien réel de référence
-- Matterport : F38iQKKXgr5 — 29 rue du Sergent Godefroy, 93100 Montreuil
-- Usage : select seed_demo_property('<organization_id>');
-- (l'organization_id est visible dans Supabase > table organizations
--  après votre première inscription)
-- ============================================================

create or replace function seed_demo_property(p_org uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_property uuid;
begin
  insert into properties (
    organization_id, title, address, city, postal_code, property_type,
    price, surface, rooms_count, description, highlights, facts,
    matterport_model_id, agent_name, is_published
  ) values (
    p_org,
    'Appartement avec jardin — Sergent Godefroy',
    '29 rue du Sergent Godefroy', 'Montreuil', '93100', 'appartement',
    575000, 81, 4,
    'Appartement familial de 81 m² avec jardin privatif, au calme, à proximité immédiate du métro Croix de Chavaux. Volumes traversants, lumière naturelle toute la journée.',
    array[
      'Jardin privatif — rare à Montreuil',
      'À 5 minutes à pied du métro Croix de Chavaux (ligne 9)',
      'Séjour traversant très lumineux',
      'Quartier vivant : marché, commerces, écoles'
    ],
    jsonb_build_object(
      'prix', '575 000 €',
      'surface', '81 m²',
      'exterieur', 'jardin privatif',
      'transports', 'Métro Croix de Chavaux (L9) à 5 min à pied'
      -- DPE, charges, taxe foncière : à renseigner via l'onglet IA
      -- ou en important les documents (l'IA répondra honnêtement
      -- "je transmets votre question à l'agence" tant que la donnée manque)
    ),
    'F38iQKKXgr5', 'Claire', true
  ) returning id into new_property;

  insert into property_rooms (property_id, label, talking_points, tour_order) values
    (new_property, 'Entrée', array['Première impression : volumes et rangements', 'Distribution fluide vers les pièces de vie'], 0),
    (new_property, 'Séjour', array['Pièce de vie traversante et lumineuse', 'Ouverture directe sur le jardin'], 1),
    (new_property, 'Cuisine', array['Cuisine équipée et fonctionnelle', 'Possibilité d''ouverture sur le séjour (à confirmer techniquement)'], 2),
    (new_property, 'Chambre 1', array['Chambre parentale au calme', 'Beaux rangements'], 3),
    (new_property, 'Chambre 2', array['Idéale chambre d''enfant ou bureau'], 4),
    (new_property, 'Salle d''eau', array['Salle d''eau fonctionnelle', 'Arrivées d''eau permettant une rénovation facile'], 5),
    (new_property, 'Jardin', array['Le grand atout du bien : jardin privatif', 'Espace repas extérieur, exposition agréable'], 6);

  return new_property;
end $$;

-- Exemple :
-- select seed_demo_property((select id from organizations limit 1));
