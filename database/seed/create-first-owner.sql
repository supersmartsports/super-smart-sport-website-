-- Run once, by hand, in the Supabase SQL editor AFTER creating the owner's login in
-- Authentication > Users. Replace the two placeholders. This creates the owner's staff profile;
-- it adds no business data.

insert into profiles (id, full_name, email, role_id)
values (
  '00000000-0000-0000-0000-000000000000',        -- the user's id from Authentication > Users
  'Owner full name',                              -- the owner's name
  'owner@example.com',                            -- the owner's login email
  (select id from roles where key = 'super_admin')
);
