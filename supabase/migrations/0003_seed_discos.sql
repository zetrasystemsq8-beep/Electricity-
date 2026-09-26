insert into powerpal.discos (name, short_code, region) values
  ('Abuja Electricity Distribution Company', 'abuja-electric', 'Abuja'),
  ('Benin Electricity Distribution Company', 'benin-electric', 'Edo/Delta'),
  ('Eko Electricity Distribution Company', 'eko-electric', 'Lagos (Eko)'),
  ('Enugu Electricity Distribution Company', 'enugu-electric', 'South East'),
  ('Ibadan Electricity Distribution Company', 'ibadan-electric', 'South West'),
  ('Ikeja Electric', 'ikeja-electric', 'Lagos (Ikeja)'),
  ('Jos Electricity Distribution Company', 'jos-electric', 'North Central'),
  ('Kaduna Electric', 'kaduna-electric', 'North West'),
  ('Kano Electricity Distribution Company', 'kano-electric', 'North West'),
  ('Port Harcourt Electricity Distribution Company', 'portharcourt-electric', 'South South'),
  ('Yola Electricity Distribution Company', 'yola-electric', 'North East')
on conflict (short_code) do nothing;
