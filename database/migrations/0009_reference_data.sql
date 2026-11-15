-- 0009 Reference data only: permissions, the standard roles, expense categories and the order workflow.
-- No customers, orders, prices or any other business figures are created here.

insert into business_settings (id) values (true) on conflict (id) do nothing;

insert into permissions (key, module, description) values
  ('customers.read',        'customers',     'View customers'),
  ('customers.write',       'customers',     'Create and edit customers and notes'),
  ('customers.archive',     'customers',     'Archive customers'),
  ('customers.export',      'customers',     'Export customer records'),
  ('inquiries.read',        'inquiries',     'View inquiries'),
  ('inquiries.write',       'inquiries',     'Update inquiries and log communication'),
  ('quotations.read',       'quotations',    'View quotations'),
  ('quotations.write',      'quotations',    'Create and edit quotations'),
  ('quotations.convert',    'quotations',    'Convert an accepted quotation into an order'),
  ('orders.read',           'orders',        'View orders'),
  ('orders.write',          'orders',        'Create and edit orders'),
  ('orders.update_status',  'orders',        'Move an order through its workflow'),
  ('production.read',       'production',    'View production batches and tasks'),
  ('production.write',      'production',    'Manage batches, tasks and assignments'),
  ('quality.read',          'quality',       'View quality inspections'),
  ('quality.write',         'quality',       'Record quality inspections'),
  ('products.read',         'products',      'View products'),
  ('products.write',        'products',      'Manage products'),
  ('materials.read',        'materials',     'View raw materials and stock'),
  ('materials.write',       'materials',     'Record material purchases, use and adjustments'),
  ('suppliers.read',        'suppliers',     'View suppliers and purchase orders'),
  ('suppliers.write',       'suppliers',     'Manage suppliers and purchase orders'),
  ('payments.read',         'payments',      'View payments'),
  ('payments.write',        'payments',      'Record pending payments'),
  ('payments.confirm',      'payments',      'Confirm that money has been received'),
  ('invoices.read',         'invoices',      'View invoices'),
  ('invoices.write',        'invoices',      'Create and edit draft invoices and adjustments'),
  ('invoices.finalize',     'invoices',      'Finalize invoices'),
  ('expenses.read',         'expenses',      'View expenses'),
  ('expenses.write',        'expenses',      'Record and void expenses'),
  ('finance.read',          'finance',       'View profit, costs, exchange rates and financial reports'),
  ('finance.write',         'finance',       'Record order costs and exchange rates'),
  ('shipping.read',         'shipping',      'View shipments'),
  ('shipping.write',        'shipping',      'Manage shipments and tracking'),
  ('reports.read',          'reports',       'View operational reports'),
  ('reports.export',        'reports',       'Export reports'),
  ('employees.read',        'employees',     'View employees, roles and permissions'),
  ('employees.manage',      'employees',     'Create employees and change roles and permissions'),
  ('notifications.read',    'notifications', 'Receive notifications'),
  ('attachments.read',      'attachments',   'View uploaded files'),
  ('attachments.write',     'attachments',   'Upload and remove files'),
  ('settings.read',         'settings',      'View business settings'),
  ('settings.manage',       'settings',      'Change business settings'),
  ('audit.read',            'audit',         'View the audit log'),
  ('tasks.read_assigned',   'production',    'See and update tasks assigned to you')
on conflict (key) do nothing;

insert into roles (key, name, description, is_system) values
  ('super_admin',        'Owner / Super Admin', 'Full access to everything, including finance, employees and settings', true),
  ('admin',              'Admin',               'Operational modules: customers, sales, production, materials, shipping', true),
  ('sales_manager',      'Sales Manager',       'Customers, inquiries, quotations and orders', true),
  ('production_manager', 'Production Manager',  'Production, quality control, materials and suppliers', true),
  ('finance_manager',    'Finance Manager',     'Payments, invoices, expenses and financial reports', true),
  ('employee',           'Employee',            'Only the tasks assigned to them', true)
on conflict (key) do nothing;

-- Role permissions. The owner needs none listed: app.has_permission() treats super_admin as holding all of them.
insert into role_permissions (role_id, permission_key)
select r.id, p.key
from roles r
join permissions p on
  (r.key = 'admin' and p.module in ('customers', 'inquiries', 'quotations', 'orders', 'production', 'quality', 'products',
                                    'materials', 'suppliers', 'shipping', 'notifications', 'attachments')
                   and p.key <> 'customers.export')
  or (r.key = 'admin' and p.key in ('reports.read', 'settings.read', 'employees.read'))
  or (r.key = 'sales_manager' and p.key in (
        'customers.read', 'customers.write', 'customers.export', 'inquiries.read', 'inquiries.write',
        'quotations.read', 'quotations.write', 'quotations.convert', 'orders.read', 'orders.write', 'orders.update_status',
        'products.read', 'shipping.read', 'notifications.read', 'attachments.read', 'attachments.write', 'reports.read'))
  or (r.key = 'production_manager' and p.key in (
        'orders.read', 'production.read', 'production.write', 'quality.read', 'quality.write', 'products.read',
        'materials.read', 'materials.write', 'suppliers.read', 'suppliers.write', 'shipping.read',
        'notifications.read', 'attachments.read', 'attachments.write', 'tasks.read_assigned'))
  or (r.key = 'finance_manager' and p.key in (
        'customers.read', 'orders.read', 'payments.read', 'payments.write', 'payments.confirm',
        'invoices.read', 'invoices.write', 'invoices.finalize', 'expenses.read', 'expenses.write',
        'finance.read', 'finance.write', 'shipping.read', 'reports.read', 'reports.export',
        'notifications.read', 'attachments.read', 'attachments.write', 'settings.read'))
  or (r.key = 'employee' and p.key in ('tasks.read_assigned', 'notifications.read'))
on conflict do nothing;

insert into expense_categories (key, name, kind, is_variable) values
  ('raw_materials',  'Raw materials',        'direct',    true),
  ('pu_leather',     'PU leather',           'direct',    true),
  ('tpu_materials',  'TPU materials',        'direct',    true),
  ('printing',       'Printing',             'direct',    true),
  ('ink',            'Ink',                  'direct',    true),
  ('stitching',      'Stitching',            'direct',    true),
  ('bonding',        'Bonding',              'direct',    true),
  ('labor',          'Labor',                'direct',    true),
  ('packaging',      'Packaging',            'direct',    true),
  ('shipping',       'Shipping',             'direct',    true),
  ('customs_duties', 'Customs and duties',   'direct',    true),
  ('marketing',      'Marketing',            'operating', false),
  ('office',         'Office expenses',      'operating', false),
  ('utilities',      'Utilities',            'operating', false),
  ('equipment',      'Equipment',            'operating', false),
  ('other',          'Other expenses',       'operating', false)
on conflict (key) do nothing;

-- Order workflow: forward one step at a time, a few sensible shortcuts, rework, and cancellation before dispatch.
insert into order_status_transitions (from_status, to_status) values
  ('new_inquiry', 'quotation_prepared'),
  ('quotation_prepared', 'quotation_accepted'),
  ('quotation_accepted', 'awaiting_deposit'),
  ('quotation_accepted', 'design_approval'),
  ('awaiting_deposit', 'design_approval'),
  ('design_approval', 'order_confirmed'),
  ('order_confirmed', 'materials_preparation'),
  ('materials_preparation', 'production_started'),
  ('production_started', 'quality_inspection'),
  ('quality_inspection', 'production_completed'),
  ('quality_inspection', 'production_started'),
  ('production_completed', 'ready_for_dispatch'),
  ('ready_for_dispatch', 'shipped'),
  ('shipped', 'delivered'),
  ('delivered', 'completed'),
  ('new_inquiry', 'cancelled'),
  ('quotation_prepared', 'cancelled'),
  ('quotation_accepted', 'cancelled'),
  ('awaiting_deposit', 'cancelled'),
  ('design_approval', 'cancelled'),
  ('order_confirmed', 'cancelled'),
  ('materials_preparation', 'cancelled'),
  ('production_started', 'cancelled'),
  ('quality_inspection', 'cancelled'),
  ('production_completed', 'cancelled'),
  ('ready_for_dispatch', 'cancelled')
on conflict do nothing;
