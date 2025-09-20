const DOMAIN = "https://tmdbplayer.nunesnetwork.com";
const API_BASE = "https://api.themoviedb.org/3/search";
const headers = {
    'Authorization': `Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIwYTk1NzRmZDcxMjRkNmI5ZTUyNjA4ZWEzNWQ2NzdiNCIsIm5iZiI6MTczNzU5MDQ2NC4zMjUsInN1YiI6IjY3OTE4NmMwZThiNjdmZjgzM2ZhNjM4OCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.kWqK74FSN41PZO7_ENZelydTtX0u2g6dCkAW0vFs4jU`,
    'accept': 'application/json'
};

let currentType = "movie";
let currentServer = 1;
let prevValue = '';

const searchInput = document.querySelector('.search-bar input');
const resultsContainer = document.querySelector(".result-cards");

// Dropdown functionality
function toggleDropdown() {
    document.querySelector('.dropdown').classList.toggle('active');
}

function selectServer(server, id) {
    document.querySelector('.dropdown-select span').textContent = server;
    document.querySelector('.dropdown').classList.remove('active');
    currentServer = id;
}

document.addEventListener('click', function (event) {
    const dropdown = document.querySelector('.dropdown');
    if (!dropdown.contains(event.target)) {
    dropdown.classList.remove('active');
    }
});

// Selector functionality
function selectOption(type) {
    const options = document.querySelectorAll('.option');
    const slider = document.querySelector('.slider');

    options.forEach(option => option.classList.remove('selected'));

    if (type === 'movie') {
    options[0].classList.add('selected');
    slider.style.transform = 'translateX(0)';
    } else {
    options[1].classList.add('selected');
    slider.style.transform = 'translateX(100%)';
    }

    currentType = type;

    // Run search again if there’s a query
    if (searchInput.value.trim() !== '') {
    searchTMDB(searchInput.value.trim());
    }
}

// Add Overflowing for long titles animation
function checkOverflow(card) {
    const h3Span = card.querySelector("h3 span");
    if (!h3Span) return;

    // compare text width vs container width
    if (h3Span.scrollWidth > h3Span.parentElement.clientWidth) {
    card.classList.add("overflowing");
    console.log("Overflow detected for:", h3Span.textContent);
    } else {
    card.classList.remove("overflowing");
    }
}
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
        // case: a single .result-card was added
        if (node.classList && node.classList.contains("result-card")) {
        const cardContent = node.querySelector(".card-content");
        if (cardContent) checkOverflow(cardContent);
        }
        // case: a batch of .result-card elements was added
        if (node.querySelectorAll) {
        node.querySelectorAll(".result-card .card-content").forEach(checkOverflow);
        }
    });
    });
});
// watch the results container
observer.observe(document.querySelector(".results-container"), {
    childList: true,
    subtree: true
});
// also re-check on window resize (important for responsiveness)
window.addEventListener("resize", () => {
    document.querySelectorAll(".result-card .card-content").forEach(checkOverflow);
});


// Layout animation
const container = document.querySelector(".main-container");
function animateLayoutChange(addClass) {
    const children = Array.from(container.children);
    const firstRects = children.map(el => el.getBoundingClientRect());

    if (addClass) {
    document.body.classList.add('search-focused');
    } else {
    document.body.classList.remove('search-focused');
    }

    const lastRects = children.map(el => el.getBoundingClientRect());

    children.forEach((el, i) => {
    const dx = firstRects[i].left - lastRects[i].left;
    const dy = firstRects[i].top - lastRects[i].top;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    requestAnimationFrame(() => {
    children.forEach(el => {
        el.style.transition = "transform 0.6s ease";
        el.style.transform = "translate(0,0)";
    });
    });

    setTimeout(() => {
    children.forEach(el => {
        el.style.transition = "";
    });
    }, 600);
}

// Search input
searchInput.addEventListener('input', () => {
    const currentValue = searchInput.value.trim();
    if (prevValue === '' && currentValue !== '') {
    animateLayoutChange(true);
    }
    if (prevValue !== '' && currentValue === '') {
    animateLayoutChange(false);
    resultsContainer.innerHTML = "";
    }
    if (currentValue !== '') {
    searchTMDB(currentValue);
    }
    prevValue = currentValue;
});

// Search TMDB API
async function searchTMDB(query) {
    try {
    const res = await fetch(`${API_BASE}/${currentType}?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: headers
    });
    const data = await res.json();
    displayResults(data.results || []);
    } catch (err) {
    console.error("TMDB Fetch Error:", err);
    }
}

// Display results
function displayResults(results) {
    resultsContainer.innerHTML = "";
    if (results.length === 0) {
    resultsContainer.innerHTML = '<p style="font-size: 1.5rem; color: white; font-weight: 800;">No results found.</p>';
    return;
    }

    results.forEach(item => {
    const title = currentType === "movie" ? item.title : item.name;
    const year = (currentType === "movie" ? item.release_date : item.first_air_date) || "Unknown Year";
    const poster = item.poster_path 
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : null;

    const card = document.createElement("div");
    card.className = "result-card";

    // Click Handler
    card.onclick = () => {
        // Movie
        if (currentType === "movie") {
        window.open(`${DOMAIN}/?type=movie&id=${item.id}&server=${currentServer}`, "_blank");
        // TV Show
        } else {
        window.open(`${DOMAIN}/?type=tv&id=${item.id}&server=${currentServer}&s=1&e=1`, "_blank");
        }
    };

    card.innerHTML = `
        <div class="card-image" style="${poster ? `background-image: url('${poster}'); background-size: cover; background-position: center;` : ""}">
        ${!poster ? `<i class="fas fa-film" style="font-size: 2rem;"></i>` : ""}
        </div>
        <div class="card-content">
        <h3><span>${title}</span></h3>
        <p>${year}</p>
        </div>
    `;
    resultsContainer.appendChild(card);
    });
}