// scripts/update-phones.js
// Обхожда всички редове в Supabase "venues" и попълва липсващите телефонни номера
// чрез Google Places API (Find Place -> Place Details -> formatted_phone_number).
// Пуска се еднократно (или периодично) с: node scripts/update-phones.js

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_PLACES_API_KEY) {
  console.error("Липсват env променливи: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findPlaceId(name, address) {
  const query = `${name} ${address || ""} Sofia Bulgaria`.trim();
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
    query
  )}&inputtype=textquery&fields=place_id&key=${GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === "OK" && data.candidates && data.candidates[0]) {
    return data.candidates[0].place_id;
  }
  return null;
}

async function getPhoneAndStatus(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,international_phone_number,business_status&key=${GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === "OK" && data.result) {
    return {
      phone: data.result.formatted_phone_number || data.result.international_phone_number || null,
      businessStatus: data.result.business_status || null, // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
    };
  }
  return { phone: null, businessStatus: null };
}

async function main() {
  const { data: venues, error } = await supabase.from("venues").select("id, name, address, phone");
  if (error) {
    console.error("Грешка при четене от Supabase:", error.message);
    process.exit(1);
  }

  console.log(`Заредени ${venues.length} заведения. Започвам проверка...`);

  let updated = 0;
  let closedFound = [];
  let notFound = [];

  for (const v of venues) {
    // Пропускаме тези, които вече си имат телефон в базата (изтрий тази проверка, ако искаш да презапишеш всички)
    if (v.phone) {
      continue;
    }

    try {
      const placeId = await findPlaceId(v.name, v.address);
      if (!placeId) {
        notFound.push(v.name);
        await sleep(150);
        continue;
      }

      const { phone, businessStatus } = await getPhoneAndStatus(placeId);

      if (businessStatus === "CLOSED_PERMANENTLY") {
        closedFound.push(v.name);
      }

      if (phone) {
        const { error: updErr } = await supabase.from("venues").update({ phone }).eq("id", v.id);
        if (updErr) {
          console.error(`Грешка при запис на ${v.name}:`, updErr.message);
        } else {
          updated++;
          console.log(`✓ ${v.name} -> ${phone}`);
        }
      } else {
        console.log(`— ${v.name}: няма намерен телефон в Google`);
      }
    } catch (err) {
      console.error(`Грешка за ${v.name}:`, err.message);
    }

    // малка пауза между заявките, за да не удряме rate limits
    await sleep(200);
  }

  console.log("\n===== Обобщение =====");
  console.log(`Обновени телефони: ${updated}`);
  console.log(`Ненамерени в Google Places: ${notFound.length}`);
  if (notFound.length) console.log(notFound.join(", "));
  console.log(`Възможно затворени завинаги (business_status = CLOSED_PERMANENTLY): ${closedFound.length}`);
  if (closedFound.length) console.log(closedFound.join(", "));
}

main();
