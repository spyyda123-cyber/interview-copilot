/**
 * Download curated real stock photos from Unsplash for study plan slides.
 * Each image is a real photograph — no AI-generated look, no text overlays.
 * Run: node download-images.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'public', 'study-images');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Actual Unsplash photo IDs (timestamp-hash format) mapped to each concept
// URL format: https://images.unsplash.com/photo-{ID}?w=800&h=340&fit=crop&crop=center&q=80&fm=jpg
const IMAGES = [
  // ═══════ OOP Concepts — programming/code on screen ═══════
  { file: 'oop_concepts.png',          id: '1607799279861-4dd421887fb3' },  // monitor with code
  { file: 'q_oop_pillars.png',         id: '1461749280684-dccba630e2f6' },  // hands typing code
  { file: 'q_abstract_interface.png',  id: '1542831371-29b0f74f9713' },     // code lines on screen
  { file: 'q_overload_override.png',   id: '1587620962725-abab7fe55159' },  // coding keyboard setup
  { file: 'q_final_keyword.png',       id: '1498050108021-c52f6701fb6c' },  // laptop with code
  { file: 'q_equals_reference.png',    id: '1607799279861-4dd421887fb3' },  // monitor with code

  // ═══════ Collections — network/data infrastructure ═══════
  { file: 'collections_framework.png', id: '1544197150520-dc38a4f89618' },  // ethernet cables in server
  { file: 'q_collections_arch.png',    id: '1512418490979-92798cf0f23a' },  // network wiring
  { file: 'q_arraylist_linked.png',    id: '1558489224-4e9e7e13291d' },     // data center aisle
  { file: 'q_hashmap_treemap.png',     id: '1531053151473-b3b570e964a1' },  // server rack close-up
  { file: 'q_concurrent_map.png',      id: '1537133377761-0b02d31da253' },  // server glow
  { file: 'q_iterator.png',            id: '1544197150520-dc38a4f89618' },  // ethernet cables

  // ═══════ Streams & Lambdas — data/code ═══════
  { file: 'streams_lambdas.png',       id: '1551288048181-79ead7c51782' },  // analytics on screen
  { file: 'q_streams_pipeline.png',    id: '1531206715517-56f938d7dab3' },  // data charts
  { file: 'q_lambda_func.png',         id: '1542831371-29b0f74f9713' },     // code lines
  { file: 'q_map_flatmap.png',         id: '1551288048181-79ead7c51782' },  // data analytics
  { file: 'q_terminal_ops.png',        id: '1498050108021-c52f6701fb6c' },  // laptop with code
  { file: 'q_optional_null.png',       id: '1587620962725-abab7fe55159' },  // coding setup

  // ═══════ Spring Boot — servers and code ═══════
  { file: 'spring_boot.png',           id: '1558489224-4e9e7e13291d' },     // modern data center
  { file: 'q_spring_core.png',         id: '1531053151473-b3b570e964a1' },  // server rack
  { file: 'q_spring_starters.png',     id: '1537133377761-0b02d31da253' },  // cloud computing
  { file: 'q_spring_annotation.png',   id: '1607799279861-4dd421887fb3' },  // code on monitor
  { file: 'q_actuator.png',            id: '1531206715517-56f938d7dab3' },  // data dashboard

  // ═══════ REST API & Docker ═══════
  { file: 'rest_api_docker.png',       id: '1544197150520-dc38a4f89618' },  // network cables
  { file: 'q_rest_methods.png',        id: '1512418490979-92798cf0f23a' },  // network wiring
  { file: 'q_controller.png',          id: '1461749280684-dccba630e2f6' },  // coding on laptop
  { file: 'q_exception.png',           id: '1542831371-29b0f74f9713' },     // code lines
  { file: 'q_jpa_orm.png',             id: '1558489224-4e9e7e13291d' },     // data center
  { file: 'q_jpa_annotations.png',     id: '1531053151473-b3b570e964a1' },  // server rack
  { file: 'q_docker.png',              id: '1570192147101-da7960fa0f57' },  // shipping containers!

  // ═══════ DSA — whiteboard/planning/logic ═══════
  { file: 'dsa_algorithms.png',        id: '1516321318423-f39a708a941a' },  // whiteboard writing
  { file: 'q_kadane.png',              id: '1551288048181-79ead7c51782' },  // data analytics
  { file: 'q_duplicates.png',          id: '1531206715517-56f938d7dab3' },  // data charts
  { file: 'q_two_pointer.png',         id: '1531403009284-440f080d1e12' },  // team brainstorming
  { file: 'q_tree_traversal.png',      id: '1516321318423-f39a708a941a' },  // whiteboard
  { file: 'q_bst.png',                 id: '1531403009284-440f080d1e12' },  // diagrams on board
  { file: 'q_bfs_dfs.png',             id: '1512418490979-92798cf0f23a' },  // network connectivity
  { file: 'q_dp_concept.png',          id: '1531206715517-56f938d7dab3' },  // analytics dashboard
  { file: 'q_fibonacci.png',           id: '1551288048181-79ead7c51782' },  // data visualization
  { file: 'q_knapsack.png',            id: '1516321318423-f39a708a941a' },  // planning whiteboard

  // ═══════ SQL & Database ═══════
  { file: 'sql_database.png',          id: '1558489224-4e9e7e13291d' },     // data center
  { file: 'q_sql_joins.png',           id: '1531053151473-b3b570e964a1' },  // server rack
  { file: 'q_where_having.png',        id: '1537133377761-0b02d31da253' },  // server glow
  { file: 'q_group_by.png',            id: '1531206715517-56f938d7dab3' },  // data charts
  { file: 'q_db_index.png',            id: '1544197150520-dc38a4f89618' },  // organized cables
  { file: 'q_index_types.png',         id: '1512418490979-92798cf0f23a' },  // network wiring
  { file: 'q_query_opt.png',           id: '1551288048181-79ead7c51782' },  // analytics

  // ═══════ Interview Prep — business/professional ═══════
  { file: 'interview_prep.png',        id: '1521733027303-0402ce65f973' },  // people in meeting room
  { file: 'q_tell_about.png',          id: '1556767669102-7bb5c9f2c30c' },  // professional discussion
  { file: 'q_star_method.png',         id: '1522071823910-2d1dd41adeb4' },  // collaboration at table
  { file: 'q_why_here.png',            id: '1521733027303-0402ce65f973' },  // meeting room
  { file: 'q_project.png',             id: '1531403009284-440f080d1e12' },  // brainstorming diagrams
  { file: 'q_debugging.png',           id: '1461749280684-dccba630e2f6' },  // coding on laptop
  { file: 'q_salary.png',              id: '1556767669102-7bb5c9f2c30c' },  // office discussion
  { file: 'q_career.png',              id: '1522071823910-2d1dd41adeb4' },  // business collaboration
];

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl, redirectCount = 0) => {
      if (redirectCount > 5) { reject(new Error('Too many redirects')); return; }
      const mod = requestUrl.startsWith('https') ? https : require('http');
      mod.get(requestUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
        if ([301, 302, 307, 308].includes(response.statusCode)) {
          makeRequest(response.headers.location, redirectCount + 1);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} for ${requestUrl.substring(0, 80)}`));
          return;
        }
        const file = fs.createWriteStream(filepath);
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    makeRequest(url);
  });
}

async function main() {
  console.log(`📥 Downloading ${IMAGES.length} curated real stock photos...`);
  console.log(`   ➜ Target: ${OUT_DIR}\n`);
  
  let done = 0, failed = 0;
  for (const img of IMAGES) {
    const filepath = path.join(OUT_DIR, img.file);
    const url = `https://images.unsplash.com/photo-${img.id}?w=800&h=340&fit=crop&crop=center&q=80&fm=jpg`;
    
    try {
      await downloadImage(url, filepath);
      done++;
      const sizeKB = Math.round(fs.statSync(filepath).size / 1024);
      console.log(`  ✅ [${done+failed}/${IMAGES.length}] ${img.file.padEnd(35)} ${sizeKB}KB`);
    } catch (err) {
      failed++;
      console.log(`  ❌ [${done+failed}/${IMAGES.length}] ${img.file.padEnd(35)} ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n✅ Complete! ${done} downloaded, ${failed} failed out of ${IMAGES.length}.`);
}

main();
