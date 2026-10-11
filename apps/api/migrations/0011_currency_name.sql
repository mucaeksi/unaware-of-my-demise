-- Display name of the single main currency (D-17), chosen by the owner to fit the story: "Bell's Remains".
-- The internal id stays eclipse_token (ids are never renamed); the name is data and can be changed in one statement.
UPDATE currencies SET display_name = 'Bell''s Remains' WHERE id = 'eclipse_token';
