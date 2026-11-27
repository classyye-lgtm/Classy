-- CLASSY Store schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.categories (
 id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null,
 image_url text, sort_order int default 0, is_active boolean default true, created_at timestamptz default now()
);
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), name text not null, category text not null,
 description text, price numeric(10,2) not null default 0, old_price numeric(10,2),
 stock int default 0, sizes text[] default '{}', colors text[] default '{}',
 image_url text, gallery text[] default '{}', is_active boolean default true,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.banners (
 id uuid primary key default gen_random_uuid(), title text not null, subtitle text,
 image_url text not null, button_text text, button_url text, sort_order int default 0,
 is_active boolean default true, created_at timestamptz default now()
);
create table if not exists public.reels (
 id uuid primary key default gen_random_uuid(), title text not null, video_url text,
 cover_url text, link_url text, sort_order int default 0, is_active boolean default true,
 created_at timestamptz default now()
);
create table if not exists public.looks (
 id uuid primary key default gen_random_uuid(), title text not null, image_url text not null,
 sort_order int default 0, is_active boolean default true, created_at timestamptz default now()
);
create table if not exists public.look_items (
 id uuid primary key default gen_random_uuid(), look_id uuid not null references public.looks(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 unique(look_id,product_id)
);
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.banners enable row level security;
alter table public.reels enable row level security;
alter table public.looks enable row level security;
alter table public.look_items enable row level security;

-- Public can read active content only.
drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories" on public.categories for select to anon, authenticated using (is_active = true);
drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select to anon, authenticated using (is_active = true);
drop policy if exists "public read active banners" on public.banners;
create policy "public read active banners" on public.banners for select to anon, authenticated using (is_active = true);
drop policy if exists "public read active reels" on public.reels;
create policy "public read active reels" on public.reels for select to anon, authenticated using (is_active = true);
drop policy if exists "public read active looks" on public.looks;
create policy "public read active looks" on public.looks for select to anon, authenticated using (is_active = true);
drop policy if exists "public read look items" on public.look_items;
create policy "public read look items" on public.look_items for select to anon, authenticated using (
 exists(select 1 from public.looks l where l.id=look_id and l.is_active=true)
);

-- Admin access relies on app_metadata.role = 'admin' (not user-editable metadata).
do $$ declare t text; begin
 foreach t in array array['categories','products','banners','reels','looks','look_items'] loop
  execute format('drop policy if exists "admin manage %I" on public.%I',t,t);
  execute format('create policy "admin manage %I" on public.%I for all to authenticated using ((auth.jwt()->''app_metadata''->>''role'') = ''admin'') with check ((auth.jwt()->''app_metadata''->>''role'') = ''admin'')',t,t);
 end loop;
end $$;

-- Storage bucket for compressed WebP product, banner and look images.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,8388608,array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public=true, file_size_limit=8388608, allowed_mime_types=array['image/webp','image/jpeg','image/png'];

drop policy if exists "public view CLASSY images" on storage.objects;
create policy "public view CLASSY images" on storage.objects for select to anon, authenticated using (bucket_id='product-images');
drop policy if exists "admin upload CLASSY images" on storage.objects;
create policy "admin upload CLASSY images" on storage.objects for insert to authenticated with check (bucket_id='product-images' and (auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "admin update CLASSY images" on storage.objects;
create policy "admin update CLASSY images" on storage.objects for update to authenticated using (bucket_id='product-images' and (auth.jwt()->'app_metadata'->>'role')='admin') with check (bucket_id='product-images' and (auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "admin delete CLASSY images" on storage.objects;
create policy "admin delete CLASSY images" on storage.objects for delete to authenticated using (bucket_id='product-images' and (auth.jwt()->'app_metadata'->>'role')='admin');

-- Starter categories (safe to run more than once)
insert into public.categories(name,slug,sort_order) values
('الرجالية','men',1),('الأطفال','boys',2),('الأحذية','shoes',3),('الإكسسوارات','accessories',4),('العطور','fragrance',5)
on conflict(slug) do nothing;


-- CLASSY 2.0 commerce, catalog enrichment and analytics (safe migration)
alter table public.products add column if not exists colors text[] default '{}';
alter table public.products add column if not exists tags text[] default '{}';
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists featured boolean default false;
alter table public.products add column if not exists updated_at timestamptz default now();
alter table public.banners add column if not exists starts_at timestamptz;
alter table public.banners add column if not exists ends_at timestamptz;

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 customer_name text not null default '', customer_phone text not null default '',
 shipping_address text default '', items jsonb not null default '[]'::jsonb,
 total_amount numeric(12,2) not null default 0, currency text not null default 'SAR',
 status text not null default 'new' check (status in ('new','confirmed','processing','shipped','completed','cancelled')),
 source text default 'website', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
alter table public.orders enable row level security;
drop policy if exists "public create orders" on public.orders;
drop policy if exists "admin read orders" on public.orders;
create policy "admin read orders" on public.orders for select to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin') with check ((auth.jwt()->'app_metadata'->>'role')='admin');

create table if not exists public.analytics_events (
 id bigint generated by default as identity primary key,
 event_type text not null, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);
alter table public.analytics_events enable row level security;
drop policy if exists "public insert analytics" on public.analytics_events;
create policy "public insert analytics" on public.analytics_events for insert to anon, authenticated with check (length(event_type) <= 80);
drop policy if exists "admin read analytics" on public.analytics_events;
create policy "admin read analytics" on public.analytics_events for select to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin');

create table if not exists public.newsletter_subscribers (
 id uuid primary key default gen_random_uuid(), email text not null unique,
 created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
drop policy if exists "public subscribe newsletter" on public.newsletter_subscribers;
create policy "public subscribe newsletter" on public.newsletter_subscribers for insert to anon, authenticated with check (position('@' in email)>1);
drop policy if exists "admin read newsletter" on public.newsletter_subscribers;
create policy "admin read newsletter" on public.newsletter_subscribers for select to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin');
-- CLASSY STORE PRO 3.0 additive migration
-- Run this in Supabase SQL Editor after the existing 2.0 schema.

-- Hierarchical categories (main categories + subcategories)
alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;
create index if not exists categories_parent_sort_idx
  on public.categories(parent_id, sort_order);

-- Configurable banner rotation duration
alter table public.banners
  add column if not exists slide_duration integer not null default 6;

-- Ensure product gallery metadata is present for multi-image products
alter table public.products
  add column if not exists gallery text[] not null default '{}';
alter table public.products
  add column if not exists sku text;
alter table public.products
  add column if not exists featured boolean not null default false;

-- Separate public bucket for short-form video files.
-- Upload is limited to authenticated admins; public visitors can stream/read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'classy-media',
  'classy-media',
  true,
  83886080,
  array['video/mp4','video/webm']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 83886080,
  allowed_mime_types = array['video/mp4','video/webm'];

drop policy if exists "public view CLASSY video media" on storage.objects;
create policy "public view CLASSY video media"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'classy-media');

drop policy if exists "admin upload CLASSY video media" on storage.objects;
create policy "admin upload CLASSY video media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'classy-media'
    and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

drop policy if exists "admin update CLASSY video media" on storage.objects;
create policy "admin update CLASSY video media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'classy-media'
    and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  )
  with check (
    bucket_id = 'classy-media'
    and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

drop policy if exists "admin delete CLASSY video media" on storage.objects;
create policy "admin delete CLASSY video media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'classy-media'
    and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );


-- CLASSY STORE PRO 3.0 additive migration
-- Run this in Supabase SQL Editor after the existing 2.0 schema.

-- Hierarchical categories (main categories + subcategories)
alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;
create index if not exists categories_parent_sort_idx
  on public.categories(parent_id, sort_order);

-- Configurable banner rotation duration
alter table public.banners
  add column if not exists slide_duration integer not null default 6;

-- Ensure product gallery metadata is present for multi-image products
alter table public.products
  add column if not exists gallery text[] not null default '{}';
alter table public.products
  add column if not exists sku text;
alter table public.products
  add column if not exists featured boolean not null default false;

-- Separate public bucket for short-form video files.
-- Upload is limited to authenticated admins; public visitors can stream/read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'classy-media',
  'classy-media',
  true,
  83886080,
  array['video/mp4','video/webm']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 83886080,
  allowed_mime_types = array['video/mp4','video/webm'];

drop policy if exists "public view CLASSY video media" on storage.objects;
create policy "public view CLASSY video media"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'classy-media');

drop policy if exists "admin upload CLASSY video media" on storage.objects;
create policy "admin upload CLASSY video media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'classy-media'
    and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

drop policy if exists "admin update CLASSY video media" on storage.objects;
create policy "admin update CLASSY video media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'classy-media'
    and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  )
  with check (
    bucket_id = 'classy-media'
    and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

drop policy if exists "admin delete CLASSY video media" on storage.objects;
create policy "admin delete CLASSY video media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'classy-media'
    and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );



-- Secure checkout: the browser submits product IDs and quantities only.
-- Prices and names are loaded from the database; stock is checked and decremented atomically.
create or replace function public.create_classy_order(
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address text default '',
  p_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_total numeric(12,2) := 0;
  v_items jsonb := '[]'::jsonb;
  v_pid uuid;
begin
  if length(trim(coalesce(p_customer_name,''))) < 2 or length(trim(coalesce(p_customer_phone,''))) < 6 then
    raise exception 'يرجى إدخال اسم ورقم هاتف صحيحين';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'قائمة المنتجات غير صالحة';
  end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if nullif(v_item->>'product_id','') is null then
      raise exception 'يوجد منتج غير صالح في السلة';
    end if;
    begin v_pid := (v_item->>'product_id')::uuid;
    exception when others then raise exception 'معرّف منتج غير صالح'; end;
    v_qty := greatest(1, least(50, coalesce((v_item->>'quantity')::integer,1)));
    select * into v_product from public.products where id=v_pid and is_active=true for update;
    if not found then raise exception 'أحد المنتجات لم يعد متاحاً'; end if;
    if coalesce(v_product.stock,0) < v_qty then
      raise exception 'المخزون غير كافٍ للمنتج: %', v_product.name;
    end if;
    update public.products set stock=stock-v_qty, updated_at=now() where id=v_pid;
    v_total := v_total + (v_product.price * v_qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id',v_pid,'name',v_product.name,'price',v_product.price,
      'quantity',v_qty,'size',nullif(v_item->>'size',''),'color',nullif(v_item->>'color','')
    ));
  end loop;
  insert into public.orders(id,customer_name,customer_phone,shipping_address,items,total_amount,currency,status,source)
  values(v_order_id,trim(p_customer_name),trim(p_customer_phone),coalesce(p_shipping_address,''),v_items,v_total,'SAR','new','website');
  return v_order_id;
end;
$$;
revoke all on function public.create_classy_order(text,text,text,jsonb) from public;
grant execute on function public.create_classy_order(text,text,text,jsonb) to anon, authenticated;
