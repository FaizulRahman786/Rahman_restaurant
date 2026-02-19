// ============================================
// SCROLL BEHAVIOR - Dynamic Navigation
// ============================================

class ScrollManager {
    constructor() {
        this.header = document.querySelector('.site-header');
        this.menuToggle = document.querySelector('.menu-toggle');
        this.menu = document.querySelector('.menu');
        this.lastScrollY = 0;
        this.scrollDirection = 'down';
        this.headerVisible = true;
        this.scrollTimeout;
        this.currentSection = 'home';
        
        this.init();
    }

    init() {
        // Throttled scroll listener
        window.addEventListener('scroll', () => this.throttledScroll(), { passive: true });
        
        // Menu toggle for mobile
        if (this.menuToggle) {
            this.menuToggle.addEventListener('click', () => this.toggleMobileMenu());
        }

        // Menu item click handlers
        document.querySelectorAll('.menu li a').forEach(link => {
            link.addEventListener('click', (e) => {
                this.closeMenuIfOpen();
                this.updateActiveLink(e.target);
            });
        });

        // Intersection Observer for section tracking
        this.setupIntersectionObserver();

        // Scroll indicator dots
        this.setupScrollIndicator();

        // Initial header state
        this.updateHeaderState();
    }

    // Throttle scroll events to improve performance
    throttledScroll() {
        if (this.scrollTimeout) {
            window.cancelAnimationFrame(this.scrollTimeout);
        }

        this.scrollTimeout = window.requestAnimationFrame(() => {
            this.handleScroll();
        });
    }

    // Handle scroll direction and header visibility
    handleScroll() {
        const currentScrollY = window.scrollY;

        // Determine scroll direction
        if (currentScrollY > this.lastScrollY) {
            // Scrolling down
            if (this.scrollDirection !== 'down') {
                this.scrollDirection = 'down';
            }
        } else if (currentScrollY < this.lastScrollY) {
            // Scrolling up
            if (this.scrollDirection !== 'up') {
                this.scrollDirection = 'up';
            }
        }

        // Update header visibility
        this.updateHeaderState();

        this.lastScrollY = currentScrollY;
    }

    // Update header visibility based on scroll direction
    updateHeaderState() {
        const currentScrollY = window.scrollY;

        // Hide header when scrolling down (except at top)
        if (this.scrollDirection === 'down' && currentScrollY > 100) {
            if (this.headerVisible) {
                this.header.classList.remove('show');
                this.header.classList.add('hide');
                this.headerVisible = false;
            }
        } 
        // Show header when scrolling up or at top
        else {
            if (!this.headerVisible) {
                this.header.classList.remove('hide');
                this.header.classList.add('show');
                this.headerVisible = true;
            }
        }

        // Add sticky class when scrolled
        if (currentScrollY > 20) {
            this.header.classList.add('sticky');
        } else {
            this.header.classList.remove('sticky');
        }
    }

    // Setup Intersection Observer for section tracking
    setupIntersectionObserver() {
        const sections = document.querySelectorAll('.scroll-section');
        
        const observerOptions = {
            threshold: 0.5,
            rootMargin: '-50% 0px -50% 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.id;
                    this.currentSection = sectionId;
                    this.updateActiveSectionLink(sectionId);
                    this.updateScrollIndicator(sectionId);
                }
            });
        }, observerOptions);

        sections.forEach(section => observer.observe(section));
    }

    // Update active link in navigation
    updateActiveSectionLink(sectionId) {
        // Remove active class from all links
        document.querySelectorAll('.menu a').forEach(link => {
            link.classList.remove('active');
        });

        // Add active class to the current section link
        const activeLink = document.querySelector(`.menu a[href="#${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    // Update active link when clicked
    updateActiveLink(element) {
        document.querySelectorAll('.menu a').forEach(link => {
            link.classList.remove('active');
        });
        element.classList.add('active');
    }

    // Setup scroll indicator dots
    setupScrollIndicator() {
        const sections = document.querySelectorAll('.scroll-section');
        const indicatorContainer = document.querySelector('.scroll-indicator');

        if (!indicatorContainer) return;

        sections.forEach((section, index) => {
            const dot = document.createElement('div');
            dot.className = 'dot';
            if (index === 0) dot.classList.add('active');
            dot.addEventListener('click', () => {
                section.scrollIntoView({ behavior: 'smooth' });
            });
            indicatorContainer.appendChild(dot);
        });
    }

    // Update scroll indicator active dot
    updateScrollIndicator(sectionId) {
        const sections = Array.from(document.querySelectorAll('.scroll-section'));
        const currentIndex = sections.findIndex(s => s.id === sectionId);

        document.querySelectorAll('.dot').forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }

    // Toggle mobile menu
    toggleMobileMenu() {
        this.menuToggle.classList.toggle('active');
        this.menu.classList.toggle('active');
    }

    // Close menu if open
    closeMenuIfOpen() {
        if (this.menu.classList.contains('active')) {
            this.menuToggle.classList.remove('active');
            this.menu.classList.remove('active');
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new ScrollManager();
});

// ============================================
// SMOOTH FADE-IN ANIMATIONS
// ============================================

class AnimationObserver {
    constructor() {
        this.init();
    }

    init() {
        const animatedElements = document.querySelectorAll('[data-animate]');
        
        const observerOptions = {
            threshold: 0.2,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const animationType = entry.target.dataset.animate;
                    entry.target.classList.add(animationType);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        animatedElements.forEach(element => observer.observe(element));
    }
}

// Initialize animations
document.addEventListener('DOMContentLoaded', () => {
    new AnimationObserver();
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Smooth scroll to section
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Get current section
function getCurrentSection() {
    return document.querySelector('.scroll-section.active')?.id || 'home';
}

// Add smooth scroll class on load
window.addEventListener('load', () => {
    document.documentElement.style.scrollBehavior = 'smooth';
});

// ============================================
// LAZY LOAD IMAGES
// ============================================

class LazyLoader {
    constructor() {
        this.init();
    }

    init() {
        // Use Intersection Observer for lazy loading
        const images = document.querySelectorAll('img[data-src]');

        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '50px'
        });

        images.forEach(img => imageObserver.observe(img));
    }
}

// Initialize lazy loader
document.addEventListener('DOMContentLoaded', () => {
    new LazyLoader();
});

// ============================================
// MENU FILTERING (if applicable)
// ============================================

class MenuFilter {
    constructor() {
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.menuItems = document.querySelectorAll('.menu-item');
        this.menuContainer = document.getElementById('menuItemsRow');
        this.searchInput = document.getElementById('headerMenuSearchInput');
        this.searchButton = document.getElementById('headerMenuSearchBtn');
        this.emptyState = document.getElementById('menuEmptyState');
        this.imageSourceMap = {};
        this.activeFilter = 'all';
        this.searchQuery = '';
        this.vegItems = this.buildVegItems();
        this.nonVegItems = this.buildNonVegItems();
        this.menuItemsData = [...this.vegItems, ...this.nonVegItems];
        this.init();
    }

    async init() {
        if (!this.menuContainer || this.filterButtons.length === 0) return;

        await this.loadImageSourceMap();
        this.applyImageSourceMap();
        this.renderMenuItems();

        this.filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.handleFilter(e.target);
            });
        });

        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.searchQuery = String(e.target.value || '').trim().toLowerCase();
                this.applyFilters(true);
            });

            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                this.searchQuery = String(this.searchInput.value || '').trim().toLowerCase();
                this.applyFilters(true);
            });
        }

        if (this.searchButton) {
            this.searchButton.addEventListener('click', () => {
                this.searchQuery = String(this.searchInput?.value || '').trim().toLowerCase();
                this.applyFilters(true);
            });
        }

        const activeButton = document.querySelector('.filter-btn.active') || this.filterButtons[0];
        if (activeButton) {
            this.activeFilter = activeButton.dataset.filter || 'all';
            this.applyFilters();
        }

        window.menuDataForCopy = {
            vegItems: this.vegItems,
            nonVegItems: this.nonVegItems
        };
        console.log('vegItems', this.vegItems);
        console.log('nonVegItems', this.nonVegItems);
    }

    async loadImageSourceMap() {
        try {
            const response = await fetch('assets/images/dish/image-source-map.json', { cache: 'no-cache' });
            if (!response.ok) return;
            const rows = await response.json();
            this.imageSourceMap = Array.isArray(rows)
                ? rows.reduce((map, row) => {
                    if (row && row.file && row.source) {
                        map[row.file] = row.source;
                    }
                    return map;
                }, {})
                : {};
        } catch {
            this.imageSourceMap = {};
        }
    }

    applyImageSourceMap() {
        if (!this.imageSourceMap || Object.keys(this.imageSourceMap).length === 0) return;

        this.menuItemsData = this.menuItemsData.map(item => {
            const parts = String(item.placeholderPath || '').split('/');
            const fileName = parts[parts.length - 1] || '';
            const sourceUrl = this.imageSourceMap[fileName];

            if (sourceUrl) {
                return { ...item, placeholderPath: sourceUrl };
            }

            return item;
        });
    }

    buildVegItems() {
        return [
            { id: 1, name: 'Paneer Tikka', desc: 'Grilled paneer cubes with smoky spice marinade and mint chutney (nut-free option).', price: 8.99, category: 'veg', subcategory: 'appetizer', imageDesc: 'Close-up of char-grilled paneer tikka skewers with onions, peppers, lemon wedges and mint chutney on a cast-iron platter.', placeholderPath: 'assets/images/dish/veg-paneer-tikka.jpg' },
            { id: 2, name: 'Aloo Gobi', desc: 'Cauliflower and potatoes sautéed with turmeric, cumin and fresh coriander.', price: 9.49, category: 'veg', subcategory: 'main', imageDesc: 'Golden aloo gobi with cauliflower florets and potato cubes in a rustic brass bowl topped with coriander.', placeholderPath: 'assets/images/dish/veg-aloo-gobi.jpg' },
            { id: 3, name: 'Dal Makhani', desc: 'Slow-cooked black lentils in creamy tomato-butter gravy (dairy-light version available).', price: 10.99, category: 'veg', subcategory: 'main', imageDesc: 'Rich dal makhani with cream swirl and cilantro in a copper handi, warm naan in background.', placeholderPath: 'assets/images/dish/veg-dal-makhani.jpg' },
            { id: 4, name: 'Vegetable Biryani', desc: 'Fragrant basmati layered with seasonal vegetables, saffron and fried onions.', price: 11.49, category: 'veg', subcategory: 'main', imageDesc: 'Steaming vegetable biryani with saffron rice, carrots, beans and crispy onions served with raita.', placeholderPath: 'assets/images/dish/veg-vegetable-biryani.jpg' },
            { id: 5, name: 'Palak Paneer', desc: 'Soft paneer in velvety spinach gravy, packed with greens and flavor.', price: 10.49, category: 'veg', subcategory: 'main', imageDesc: 'Creamy green palak paneer with paneer cubes and light cream drizzle in an elegant bowl.', placeholderPath: 'assets/images/dish/veg-palak-paneer.jpg' },
            { id: 6, name: 'Chana Masala', desc: 'Protein-rich chickpeas simmered in tangy tomato-onion masala.', price: 8.99, category: 'veg', subcategory: 'main', imageDesc: 'Deep red chana masala garnished with ginger juliennes, onion and lemon on side.', placeholderPath: 'assets/images/dish/veg-chana-masala.jpg' },
            { id: 7, name: 'Vegetable Pakora', desc: 'Crispy vegetable fritters served with mint and tamarind chutneys.', price: 6.99, category: 'veg', subcategory: 'appetizer', imageDesc: 'Golden crunchy vegetable pakoras stacked in a basket with two chutney bowls.', placeholderPath: 'assets/images/dish/veg-vegetable-pakora.jpg' },
            { id: 8, name: 'Rajma', desc: 'Comforting kidney bean curry with Punjabi-style spices and herbs.', price: 9.99, category: 'veg', subcategory: 'main', imageDesc: 'Rajma curry with glossy kidney beans in thick gravy served with steamed rice.', placeholderPath: 'assets/images/dish/veg-rajma.jpg' },
            { id: 9, name: 'Malai Kofta', desc: 'Paneer-veg dumplings in creamy gravy (contains dairy and nuts).', price: 11.99, category: 'veg', subcategory: 'main', imageDesc: 'Soft malai kofta balls in smooth saffron-orange gravy topped with cream and pistachio.', placeholderPath: 'assets/images/dish/veg-malai-kofta.jpg' },
            { id: 10, name: 'Gulab Jamun', desc: 'Classic syrup-soaked milk dumplings, warm and aromatic.', price: 5.99, category: 'veg', subcategory: 'dessert', imageDesc: 'Glossy gulab jamuns in sugar syrup garnished with crushed pistachios in a small bowl.', placeholderPath: 'assets/images/dish/veg-gulab-jamun.jpg' },
            { id: 11, name: 'Ras Malai', desc: 'Soft chenna discs in saffron milk, light festive dessert.', price: 6.49, category: 'veg', subcategory: 'dessert', imageDesc: 'Ras malai discs in creamy saffron milk with almond slivers and rose petals.', placeholderPath: 'assets/images/dish/veg-ras-malai.jpg' },
            { id: 12, name: 'Mango Lassi', desc: 'Chilled mango yogurt drink, refreshing and probiotic-rich.', price: 4.99, category: 'veg', subcategory: 'beverage', imageDesc: 'Thick mango lassi in tall glass topped with saffron strands and mint leaves.', placeholderPath: 'assets/images/dish/veg-mango-lassi.jpg' },
            { id: 13, name: 'Jeera Rice', desc: 'Basmati rice tempered with cumin and ghee aroma.', price: 5.49, category: 'veg', subcategory: 'main', imageDesc: 'Fluffy jeera rice with toasted cumin seeds served in a white ceramic bowl.', placeholderPath: 'assets/images/dish/veg-jeera-rice.jpg' },
            { id: 14, name: 'Aloo Paratha', desc: 'Stuffed potato flatbread served with curd and pickle.', price: 7.49, category: 'veg', subcategory: 'appetizer', imageDesc: 'Golden aloo paratha cut into wedges with butter, yogurt and pickle on a thali plate.', placeholderPath: 'assets/images/dish/veg-aloo-paratha.jpg' },
            { id: 15, name: 'Baingan Bharta', desc: 'Smoky roasted eggplant mash with onion, tomato and spices.', price: 9.49, category: 'veg', subcategory: 'main', imageDesc: 'Rustic baingan bharta with fire-roasted texture topped with fresh cilantro.', placeholderPath: 'assets/images/dish/veg-baingan-bharta.jpg' },
            { id: 16, name: 'Vegetable Korma', desc: 'Mild creamy mixed-vegetable curry (vegan coconut option available).', price: 10.99, category: 'veg', subcategory: 'main', imageDesc: 'Mixed vegetable korma with carrots, peas and beans in silky cream sauce.', placeholderPath: 'assets/images/dish/veg-vegetable-korma.jpg' },
            { id: 17, name: 'Samosa', desc: 'Crisp pastry pockets with spiced potato filling and chutneys.', price: 5.99, category: 'veg', subcategory: 'appetizer', imageDesc: 'Two golden samosas broken open showing spiced potato filling with chutney dips.', placeholderPath: 'assets/images/dish/veg-samosa.jpg' },
            { id: 18, name: 'Kheer', desc: 'Traditional rice pudding with cardamom and nuts (nut-free on request).', price: 5.49, category: 'veg', subcategory: 'dessert', imageDesc: 'Creamy kheer in earthen pot topped with saffron and chopped almonds.', placeholderPath: 'assets/images/dish/veg-kheer.jpg' },
            { id: 19, name: 'Masala Chai', desc: 'Spiced tea brewed with milk, cardamom, ginger and cinnamon.', price: 3.99, category: 'veg', subcategory: 'beverage', imageDesc: 'Steaming masala chai in kulhad cup with whole spices scattered around.', placeholderPath: 'assets/images/dish/veg-masala-chai.jpg' },
            { id: 20, name: 'Poha', desc: 'Light flattened rice breakfast with peanuts and curry leaves (contains peanuts).', price: 6.49, category: 'veg', subcategory: 'appetizer', imageDesc: 'Yellow poha with peanuts, sev and coriander served with lemon wedge.', placeholderPath: 'assets/images/dish/veg-poha.jpg' }
        ];
    }

    buildNonVegItems() {
        return [
            { id: 21, name: 'Butter Chicken', desc: 'Tender chicken in creamy tomato-butter gravy, rich and comforting.', price: 12.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Butter chicken in orange gravy with cream swirl and cilantro served in copper bowl.', placeholderPath: 'assets/images/dish/nonveg-butter-chicken.jpg' },
            { id: 22, name: 'Chicken Tikka Masala', desc: 'Char-grilled chicken simmered in bold tomato masala sauce.', price: 13.49, category: 'non-veg', subcategory: 'main', imageDesc: 'Chicken tikka masala with charred chicken cubes and thick red-orange curry.', placeholderPath: 'assets/images/dish/nonveg-chicken-tikka-masala.jpg' },
            { id: 23, name: 'Mutton Rogan Josh', desc: 'Slow-cooked Kashmiri mutton curry with aromatic whole spices.', price: 14.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Rogan josh with tender mutton pieces in deep red gravy garnished with coriander.', placeholderPath: 'assets/images/dish/nonveg-mutton-rogan-josh.jpg' },
            { id: 24, name: 'Fish Curry', desc: 'Coastal-style fish curry with coconut and tangy spice notes.', price: 13.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Fish curry with golden fillets in coconut gravy with curry leaves and mustard seeds.', placeholderPath: 'assets/images/dish/nonveg-fish-curry.jpg' },
            { id: 25, name: 'Chicken Biryani', desc: 'Layered basmati rice and spiced chicken, a complete festive meal.', price: 12.49, category: 'non-veg', subcategory: 'main', imageDesc: 'Chicken biryani with saffron rice, fried onions and boiled egg on top.', placeholderPath: 'assets/images/dish/nonveg-chicken-biryani.jpg' },
            { id: 26, name: 'Tandoori Chicken', desc: 'Yogurt-marinated chicken roasted in tandoor for smoky flavor.', price: 11.99, category: 'non-veg', subcategory: 'appetizer', imageDesc: 'Bright red tandoori chicken legs with lemon wedges and onion rings.', placeholderPath: 'assets/images/dish/nonveg-tandoori-chicken.jpg' },
            { id: 27, name: 'Keema Naan', desc: 'Stuffed flatbread with minced mutton, savory and filling.', price: 7.99, category: 'non-veg', subcategory: 'appetizer', imageDesc: 'Golden keema naan sliced open showing juicy minced meat filling.', placeholderPath: 'assets/images/dish/nonveg-keema-naan.jpg' },
            { id: 28, name: 'Prawn Masala', desc: 'Juicy prawns in spicy onion-tomato masala.', price: 14.49, category: 'non-veg', subcategory: 'main', imageDesc: 'Prawn masala with whole prawns in glossy red gravy served hot.', placeholderPath: 'assets/images/dish/nonveg-prawn-masala.jpg' },
            { id: 29, name: 'Egg Curry', desc: 'Boiled eggs in homestyle spiced gravy, protein-rich and hearty.', price: 9.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Egg curry with halved eggs in turmeric-red gravy with cilantro garnish.', placeholderPath: 'assets/images/dish/nonveg-egg-curry.jpg' },
            { id: 30, name: 'Mutton Biryani', desc: 'Fragrant biryani with slow-cooked mutton and aromatic spices.', price: 13.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Mutton biryani with saffron rice and tender mutton chunks in a handi.', placeholderPath: 'assets/images/dish/nonveg-mutton-biryani.jpg' },
            { id: 31, name: 'Chicken Seekh Kebab', desc: 'Minced chicken skewers grilled with herbs and spices.', price: 8.99, category: 'non-veg', subcategory: 'appetizer', imageDesc: 'Chicken seekh kebabs on skewers with mint chutney and sliced onions.', placeholderPath: 'assets/images/dish/nonveg-chicken-seekh-kebab.jpg' },
            { id: 32, name: 'Lamb Chops', desc: 'Marinated lamb chops flame-grilled, juicy and flavorful.', price: 15.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Charred lamb chops arranged on a plate with herbs and roasted vegetables.', placeholderPath: 'assets/images/dish/nonveg-lamb-chops.jpg' },
            { id: 33, name: 'Fish Tikka', desc: 'Boneless fish chunks marinated and grilled till succulent.', price: 12.49, category: 'non-veg', subcategory: 'appetizer', imageDesc: 'Fish tikka skewers with golden crust and green chutney on side.', placeholderPath: 'assets/images/dish/nonveg-fish-tikka.jpg' },
            { id: 34, name: 'Chicken Korma', desc: 'Mild creamy chicken curry with cashew notes (contains nuts).', price: 12.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Chicken korma in pale creamy gravy topped with almond slivers.', placeholderPath: 'assets/images/dish/nonveg-chicken-korma.jpg' },
            { id: 35, name: 'Keema Matar', desc: 'Minced mutton cooked with green peas and warm spices.', price: 11.49, category: 'non-veg', subcategory: 'main', imageDesc: 'Keema matar with peas and minced mutton in rich semi-dry masala.', placeholderPath: 'assets/images/dish/nonveg-keema-matar.jpg' },
            { id: 36, name: 'Prawn Biryani', desc: 'Saffron rice layered with prawns and aromatic masala.', price: 14.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Prawn biryani with juicy shrimp, fried onions and long-grain basmati.', placeholderPath: 'assets/images/dish/nonveg-prawn-biryani.jpg' },
            { id: 37, name: 'Chicken 65', desc: 'Spicy fried chicken bites tossed with curry leaves.', price: 9.49, category: 'non-veg', subcategory: 'appetizer', imageDesc: 'Crispy red chicken 65 bites with curry leaves and onion rings.', placeholderPath: 'assets/images/dish/nonveg-chicken-65.jpg' },
            { id: 38, name: 'Mutton Korma', desc: 'Festive mutton curry in rich creamy gravy.', price: 13.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Mutton korma with thick creamy gravy and saffron garnish.', placeholderPath: 'assets/images/dish/nonveg-mutton-korma.jpg' },
            { id: 39, name: 'Egg Biryani', desc: 'Flavorful biryani with boiled eggs and fried onions.', price: 10.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Egg biryani with halved eggs on aromatic basmati rice.', placeholderPath: 'assets/images/dish/nonveg-egg-biryani.jpg' },
            { id: 40, name: 'Fish Fry', desc: 'Crispy spiced fish fillets, light and crunchy starter.', price: 11.49, category: 'non-veg', subcategory: 'appetizer', imageDesc: 'Golden fish fry fillets with lemon wedges and onion salad.', placeholderPath: 'assets/images/dish/nonveg-fish-fry.jpg' },
            { id: 41, name: 'Chicken Saag', desc: 'Chicken simmered in spinach gravy, hearty and nutrient-rich.', price: 12.49, category: 'non-veg', subcategory: 'main', imageDesc: 'Chicken saag with green spinach gravy and tender chicken pieces.', placeholderPath: 'assets/images/dish/nonveg-chicken-saag.jpg' },
            { id: 42, name: 'Mutton Seekh Kebab', desc: 'Smoky minced mutton skewers with robust spice blend.', price: 10.99, category: 'non-veg', subcategory: 'appetizer', imageDesc: 'Mutton seekh kebabs on metal skewers with mint dip and lemon.', placeholderPath: 'assets/images/dish/nonveg-mutton-seekh-kebab.jpg' },
            { id: 43, name: 'Prawn Korma', desc: 'Creamy mild prawn curry with subtle spice and richness.', price: 14.49, category: 'non-veg', subcategory: 'main', imageDesc: 'Prawn korma in creamy white-gold gravy garnished with nuts.', placeholderPath: 'assets/images/dish/nonveg-prawn-korma.jpg' },
            { id: 44, name: 'Chicken Vindaloo', desc: 'Tangy and spicy Goan-style chicken curry.', price: 12.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Chicken vindaloo in deep red spicy gravy with potato pieces.', placeholderPath: 'assets/images/dish/nonveg-chicken-vindaloo.jpg' },
            { id: 45, name: 'Lamb Biryani', desc: 'Aromatic basmati with tender lamb and caramelized onions.', price: 14.99, category: 'non-veg', subcategory: 'main', imageDesc: 'Lamb biryani in serving pot with saffron strands and herbs.', placeholderPath: 'assets/images/dish/nonveg-lamb-biryani.jpg' },
            { id: 46, name: 'Chicken Pakora', desc: 'Crispy marinated chicken fritters, perfect tea-time snack.', price: 8.49, category: 'non-veg', subcategory: 'appetizer', imageDesc: 'Golden chicken pakora pieces with mint chutney and sliced onions.', placeholderPath: 'assets/images/dish/nonveg-chicken-pakora.jpg' },
            { id: 47, name: 'Mutton Saag', desc: 'Mutton cooked in smooth spinach puree, rustic Punjabi favorite.', price: 13.49, category: 'non-veg', subcategory: 'main', imageDesc: 'Mutton saag with rich green gravy and soft mutton pieces.', placeholderPath: 'assets/images/dish/nonveg-mutton-saag.jpg' },
            { id: 48, name: 'Fish Pakora', desc: 'Spiced fish fritters fried crisp and served with chutney.', price: 9.99, category: 'non-veg', subcategory: 'appetizer', imageDesc: 'Crispy fish pakora bites with lemon and coriander garnish.', placeholderPath: 'assets/images/dish/nonveg-fish-pakora.jpg' },
            { id: 49, name: 'Chicken Dhansak', desc: 'Parsi-inspired chicken curry with lentils and sweet-sour balance.', price: 12.49, category: 'non-veg', subcategory: 'main', imageDesc: 'Chicken dhansak with lentil-rich gravy and herbs in a traditional bowl.', placeholderPath: 'assets/images/dish/nonveg-chicken-dhansak.jpg' },
            { id: 50, name: 'Keema Pav', desc: 'Street-style minced chicken served with buttered pav buns.', price: 7.99, category: 'non-veg', subcategory: 'appetizer', imageDesc: 'Spicy keema with toasted pav buns, onions and lemon on a plate.', placeholderPath: 'assets/images/dish/nonveg-keema-pav.jpg' }
        ];
    }

    renderMenuItems() {
        if (!this.menuContainer) return;

        const cards = this.menuItemsData.map((item) => {
            const icon = item.category === 'veg'
                ? '<i class="fas fa-leaf text-success" aria-hidden="true"></i>'
                : '<i class="fas fa-drumstick-bite text-danger" aria-hidden="true"></i>';

            return `
            <div class="col-3 menu-item" data-category="${item.category}" data-subcategory="${item.subcategory}" data-animate="fade-up" data-item-id="${item.id}">
              <div style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1); padding: 20px; text-align: center;">
                                <div style="width: 100%; height: 300px; border-radius: 10px; margin-bottom: 15px; overflow: hidden; background: #f3f3f5;">
                                    <img src="${item.placeholderPath}" alt="${item.imageDesc}" style="width: 100%; height: 100%; object-fit: contain; object-position: center; display: block;" loading="lazy" />
                </div>
                <h4 style="color: #0d0d25; display: flex; justify-content: center; align-items: center; gap: 8px;">${icon}<span>${item.name}</span></h4>
                <p style="color: #666; font-size: 14px; margin: 10px 0">${item.desc}</p>
                <p class="item-price" style="color: #ff8243; font-size: 18px; font-weight: bold; margin: 10px 0">$${Number(item.price).toFixed(2)}</p>
                <button class="add-to-cart sec-btn" style="width: 100%">Add to Cart</button>
              </div>
            </div>`;
        }).join('');

        this.menuContainer.innerHTML = cards;
        this.menuItems = this.menuContainer.querySelectorAll('.menu-item');
        document.dispatchEvent(new Event('menu:rendered'));
    }

    applyFilters(shouldAutoScroll = false) {
        if (!this.menuItems || this.menuItems.length === 0) return;

        let visibleCount = 0;
        const normalizedQuery = this.searchQuery.replace(/[$\s]/g, '');
        let firstVisibleItem = null;

        this.menuItems.forEach(item => {
            const itemCategory = (item.dataset.category || '').toLowerCase();
            const itemSubcategory = (item.dataset.subcategory || '').toLowerCase();
            const itemName = (item.querySelector('h4 span')?.textContent || '').toLowerCase();
            const itemDesc = (item.querySelector('p')?.textContent || '').toLowerCase();
            const itemPrice = (item.querySelector('.item-price')?.textContent || '').toLowerCase();
            const normalizedPrice = itemPrice.replace(/[$\s]/g, '');

            const matchesCategory =
                this.activeFilter === 'all'
                || itemCategory === this.activeFilter
                || itemSubcategory === this.activeFilter;

            const matchesSearch =
                !this.searchQuery
                || itemName.includes(this.searchQuery)
                || itemDesc.includes(this.searchQuery)
                || itemPrice.includes(this.searchQuery)
                || itemCategory.includes(this.searchQuery)
                || itemSubcategory.includes(this.searchQuery)
                || (normalizedQuery && normalizedPrice.includes(normalizedQuery));

            const shouldShow = matchesCategory && matchesSearch;

            this.applySearchHighlight(item);

            if (shouldShow) {
                visibleCount += 1;
                if (!firstVisibleItem) {
                    firstVisibleItem = item;
                }
                item.style.display = 'block';
                item.style.opacity = '1';
                item.style.animation = 'fadeInUp 0.45s ease';
            } else {
                item.style.animation = 'none';
                item.style.opacity = '0';
                item.style.display = 'none';
            }
        });

        if (!this.emptyState) return;

        if (visibleCount === 0) {
            this.emptyState.hidden = false;
            this.emptyState.textContent = this.searchQuery
                ? `Not available: "${this.searchQuery}"`
                : 'Not available';
        } else {
            this.emptyState.hidden = true;
            this.emptyState.textContent = 'Not available';

            if (shouldAutoScroll && this.searchQuery && firstVisibleItem) {
                firstVisibleItem.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
            }
        }
    }

    applySearchHighlight(item) {
        const nameEl = item.querySelector('h4 span');
        const descEl = item.querySelector('p');
        const priceEl = item.querySelector('.item-price');

        if (!nameEl || !descEl || !priceEl) return;

        if (!nameEl.dataset.rawText) nameEl.dataset.rawText = nameEl.textContent || '';
        if (!descEl.dataset.rawText) descEl.dataset.rawText = descEl.textContent || '';
        if (!priceEl.dataset.rawText) priceEl.dataset.rawText = priceEl.textContent || '';

        if (!this.searchQuery) {
            nameEl.textContent = nameEl.dataset.rawText;
            descEl.textContent = descEl.dataset.rawText;
            priceEl.textContent = priceEl.dataset.rawText;
            return;
        }

        nameEl.innerHTML = this.highlightMatch(nameEl.dataset.rawText, this.searchQuery);
        descEl.innerHTML = this.highlightMatch(descEl.dataset.rawText, this.searchQuery);
        priceEl.innerHTML = this.highlightMatch(priceEl.dataset.rawText, this.searchQuery);
    }

    highlightMatch(text, query) {
        const safeText = String(text || '');
        const safeQuery = this.escapeRegex(String(query || '').trim());

        if (!safeText || !safeQuery) {
            return safeText;
        }

        const regex = new RegExp(`(${safeQuery})`, 'ig');
        return safeText.replace(regex, '<mark class="menu-search-hit">$1</mark>');
    }

    escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    handleFilter(button) {
        // Update active button
        this.filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        this.activeFilter = (button.dataset.filter || 'all').toLowerCase();
        this.applyFilters();
    }
}

// Initialize menu filter
document.addEventListener('DOMContentLoaded', () => {
    new MenuFilter();
});

// ============================================
// FORM HANDLING
// ============================================

class FormHandler {
    constructor() {
        this.forms = document.querySelectorAll('form:not(#reservationForm)');
        this.init();
    }

    init() {
        this.forms.forEach(form => {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        });
    }

    handleSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);

        // Simulate form submission
        console.log('Form submitted:', Object.fromEntries(formData));

        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'alert alert-success';
        successMsg.textContent = 'Thank you! Your message has been sent.';
        form.parentNode.insertBefore(successMsg, form);

        // Reset form
        form.reset();

        // Remove message after 5 seconds
        setTimeout(() => {
            successMsg.remove();
        }, 5000);
    }
}

// Initialize form handler
document.addEventListener('DOMContentLoaded', () => {
    new FormHandler();
});

// ============================================
// CART FUNCTIONALITY
// ============================================

class CartManager {
    constructor() {
        this.storageKey = 'rahman_cart_items';
        this.cart = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        this.cartNumber = document.querySelector('.cart-number');
        this.addToCartButtons = document.querySelectorAll('.add-to-cart');
        this.currentItemId = null;
        this.addToCartModalElement = document.getElementById('addToCartModal');
        this.cartOverviewModalElement = document.getElementById('cartOverviewModal');
        this.qtyMinusBtn = document.getElementById('cartQtyMinus');
        this.qtyPlusBtn = document.getElementById('cartQtyPlus');
        this.popupImage = document.getElementById('cartPopupImage');
        this.popupName = document.getElementById('cartPopupName');
        this.popupDesc = document.getElementById('cartPopupDesc');
        this.popupPrice = document.getElementById('cartPopupPrice');
        this.popupQty = document.getElementById('cartPopupQty');
        this.popupTotal = document.getElementById('cartPopupTotal');
        this.cartOverviewList = document.getElementById('cartOverviewList');
        this.cartOverviewTotal = document.getElementById('cartOverviewTotal');
        this.viewCartBtn = document.getElementById('viewCartBtn');
        this.addToCartModal = this.addToCartModalElement
            ? new bootstrap.Modal(this.addToCartModalElement)
            : null;
        this.init();
    }

    init() {
        this.updateCartCount();
        this.bindModalActions();

        document.addEventListener('click', (e) => {
            const button = e.target.closest('.add-to-cart');
            if (!button) return;
            e.preventDefault();
            this.addItem(button);
        });
    }

    addItem(button) {
        const card = button.closest('[data-item-id]');
        if (!card) return;

        const itemId = String(card.dataset.itemId || '');
        const itemName = (card.querySelector('h4')?.textContent || 'Menu Item').trim();
        const itemDescription = (card.querySelector('p')?.textContent || '').trim();
        const priceText = (card.querySelector('.item-price')?.textContent || '$0').trim();
        const numericPrice = Number(priceText.replace(/[^0-9.]/g, '')) || 0;
        const itemImage = card.querySelector('img')?.getAttribute('src') || '';

        const existingItem = this.cart.find(item => item.id === itemId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                id: itemId,
                name: itemName,
                description: itemDescription,
                price: numericPrice,
                quantity: 1,
                image: itemImage
            });
        }

        this.currentItemId = itemId;
        this.persistCart();
        this.updateCartCount();
        this.showAddedFeedback(button);
        this.showAddToCartModal(itemId);
    }

    updateCartCount() {
        if (this.cartNumber) {
            const totalItems = this.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            this.cartNumber.textContent = totalItems;
        }
    }

    persistCart() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
    }

    bindModalActions() {
        if (this.qtyMinusBtn) {
            this.qtyMinusBtn.addEventListener('click', () => this.updateCurrentItemQuantity(-1));
        }

        if (this.qtyPlusBtn) {
            this.qtyPlusBtn.addEventListener('click', () => this.updateCurrentItemQuantity(1));
        }

        if (this.viewCartBtn) {
            this.viewCartBtn.addEventListener('click', () => {
                this.renderCartOverview();
            });
        }

        if (this.cartOverviewModalElement) {
            this.cartOverviewModalElement.addEventListener('show.bs.modal', () => {
                this.renderCartOverview();
            });
        }
    }

    showAddToCartModal(itemId) {
        const item = this.cart.find(entry => entry.id === itemId);
        if (!item) return;

        if (this.popupImage) this.popupImage.src = item.image;
        if (this.popupName) this.popupName.textContent = item.name;
        if (this.popupDesc) this.popupDesc.textContent = item.description;
        if (this.popupPrice) this.popupPrice.textContent = `$${item.price.toFixed(2)}`;
        if (this.popupQty) this.popupQty.textContent = String(item.quantity);
        if (this.popupTotal) this.popupTotal.textContent = `$${(item.price * item.quantity).toFixed(2)}`;

        if (this.addToCartModal) {
            this.addToCartModal.show();
        }
    }

    updateCurrentItemQuantity(delta) {
        if (!this.currentItemId) return;

        const item = this.cart.find(entry => entry.id === this.currentItemId);
        if (!item) return;

        item.quantity = Math.max(1, Number(item.quantity || 1) + delta);
        this.persistCart();
        this.updateCartCount();
        this.showAddToCartModal(this.currentItemId);
    }

    renderCartOverview() {
        if (!this.cartOverviewList || !this.cartOverviewTotal) return;

        if (!this.cart.length) {
            this.cartOverviewList.innerHTML = '<p class="text-muted mb-0">Your cart is empty.</p>';
            this.cartOverviewTotal.textContent = '$0.00';
            return;
        }

        this.cartOverviewList.innerHTML = this.cart.map(item => {
            const lineTotal = item.price * item.quantity;
            return `
                <div class="cart-row">
                    <div>
                        <strong>${item.name}</strong>
                        <div class="text-muted small">Qty: ${item.quantity}</div>
                    </div>
                    <div class="fw-semibold">$${lineTotal.toFixed(2)}</div>
                </div>
            `;
        }).join('');

        const grandTotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        this.cartOverviewTotal.textContent = `$${grandTotal.toFixed(2)}`;
    }

    showAddedFeedback(button) {
        const originalText = button.textContent;
        button.textContent = '✓ Added';
        button.style.background = '#ff8243';
        button.style.color = 'white';

        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
            button.style.color = '';
        }, 1500);
    }
}

class FavoritesManager {
    constructor() {
        this.storageKey = 'rahman_favorites';
        this.heartIconPath = 'assets/images/heart.jpg';
        this.favorites = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        this.favoriteCount = document.getElementById('favoriteCount');
        this.favoriteList = document.getElementById('favoritesOverviewList');
        this.favoritesModalElement = document.getElementById('favoritesModal');
        this.imageSelector = '.scroll-sections img';
        this.init();
    }

    init() {
        this.decorateImages();
        this.updateCount();

        document.addEventListener('menu:rendered', () => {
            this.decorateImages();
            this.updateCount();
        });

        if (this.favoritesModalElement) {
            this.favoritesModalElement.addEventListener('show.bs.modal', () => {
                this.renderFavorites();
            });
        }
    }

    persist() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.favorites));
    }

    getImageId(image) {
        const src = image.getAttribute('src') || '';
        const alt = image.getAttribute('alt') || '';
        return `${src}::${alt}`;
    }

    getImageTitle(image) {
        const card = image.closest('.menu-item, .gallery-item, .blog-post, #home');
        const heading = card?.querySelector('h4, h3, h2');
        return (heading?.textContent || image.getAttribute('alt') || 'Liked image').trim();
    }

    isLiked(id) {
        return this.favorites.some(item => item.id === id);
    }

    shouldDecorateImage(image) {
        if (!image) {
            return false;
        }

        if (
            image.closest('.follow-us-links')
            || image.closest('.follow-us-block')
            || image.closest('.header-right')
            || image.closest('.modal')
            || image.closest('.favorite-row')
            || image.closest('.contact-icon-row')
        ) {
            return false;
        }

        const width = image.clientWidth || image.naturalWidth || 0;
        const height = image.clientHeight || image.naturalHeight || 0;
        if (width > 0 && height > 0 && (width < 80 || height < 80)) {
            return false;
        }

        return true;
    }

    toggleFavorite(image, button) {
        const id = this.getImageId(image);
        const existingIndex = this.favorites.findIndex(item => item.id === id);
        let added = false;

        if (existingIndex >= 0) {
            this.favorites.splice(existingIndex, 1);
            button.classList.remove('is-liked');
            button.setAttribute('aria-label', 'Like image');
        } else {
            added = true;
            this.favorites.push({
                id,
                src: image.getAttribute('src') || '',
                alt: image.getAttribute('alt') || 'Liked image',
                title: this.getImageTitle(image)
            });
            button.classList.add('is-liked');
            button.setAttribute('aria-label', 'Unlike image');
        }

        this.persist();
        this.updateCount();
        this.showFavoriteSignal(button, added);
    }

    showFavoriteSignal(button, added) {
        const host = button.parentElement;
        if (!host) return;

        const previous = host.querySelector('.favorite-feedback');
        if (previous) {
            previous.remove();
        }

        const signal = document.createElement('span');
        signal.className = `favorite-feedback ${added ? 'is-add' : 'is-remove'}`;
        signal.textContent = added ? '✓' : '✕';
        host.appendChild(signal);

        requestAnimationFrame(() => {
            signal.classList.add('show');
        });

        window.setTimeout(() => {
            signal.classList.remove('show');
            window.setTimeout(() => {
                signal.remove();
            }, 220);
        }, 900);
    }

    decorateImages() {
        const images = document.querySelectorAll(this.imageSelector);
        images.forEach(image => {
            if (!this.shouldDecorateImage(image)) {
                const host = image.parentElement;
                const staleButton = host?.querySelector('.image-like-btn');
                if (staleButton) {
                    staleButton.remove();
                }
                image.dataset.likeReady = '0';
                return;
            }

            if (image.dataset.likeReady === '1') return;

            const parent = image.parentElement;
            if (!parent) return;

            const computed = window.getComputedStyle(parent);
            if (computed.position === 'static') {
                parent.style.position = 'relative';
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'image-like-btn';
            button.innerHTML = `<img src="${this.heartIconPath}" alt="Like" />`;

            const id = this.getImageId(image);
            if (this.isLiked(id)) {
                button.classList.add('is-liked');
                button.setAttribute('aria-label', 'Unlike image');
            } else {
                button.setAttribute('aria-label', 'Like image');
            }

            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.toggleFavorite(image, button);
            });

            parent.appendChild(button);
            image.dataset.likeReady = '1';
        });
    }

    updateCount() {
        if (this.favoriteCount) {
            this.favoriteCount.textContent = String(this.favorites.length);
        }
    }

    renderFavorites() {
        if (!this.favoriteList) return;

        if (!this.favorites.length) {
            this.favoriteList.innerHTML = '<p class="text-muted mb-0">No liked images yet. Tap hearts on images to add them here.</p>';
            return;
        }

        this.favoriteList.innerHTML = this.favorites.map(item => `
            <div class="favorite-row">
                <div class="favorite-meta">
                    <img src="${item.src}" alt="${item.alt}" class="favorite-thumb" />
                    <div>
                        <strong>${item.title}</strong>
                        <div class="text-muted small">${item.alt}</div>
                    </div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger" data-favorite-remove="${item.id}">Remove</button>
            </div>
        `).join('');

        this.favoriteList.querySelectorAll('[data-favorite-remove]').forEach(button => {
            button.addEventListener('click', () => {
                const id = button.getAttribute('data-favorite-remove') || '';
                this.favorites = this.favorites.filter(item => item.id !== id);
                this.persist();
                this.updateCount();
                this.renderFavorites();

                document.querySelectorAll('.image-like-btn').forEach(likeButton => {
                    const card = likeButton.parentElement;
                    const image = card?.querySelector('img');
                    if (!image) return;
                    if (this.getImageId(image) === id) {
                        likeButton.classList.remove('is-liked');
                        likeButton.setAttribute('aria-label', 'Like image');
                    }
                });
            });
        });
    }
}

class ThemeManager {
    constructor() {
        this.storageKey = 'rahman_theme';
        this.availableThemes = ['theme-3', 'theme-4'];
        this.bodyThemeClasses = ['theme-1', 'theme-2', 'theme-3', 'theme-4'];
        this.themeOptions = document.querySelectorAll('.theme-option');
        this.themeSwitcherBtn = document.getElementById('themeSwitcherBtn');
        this.init();
    }

    init() {
        const savedTheme = localStorage.getItem(this.storageKey) || 'theme-3';
        this.applyTheme(savedTheme);

        this.themeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const selectedTheme = option.dataset.theme || 'theme-3';
                this.applyTheme(selectedTheme);
                localStorage.setItem(this.storageKey, selectedTheme);
            });
        });
    }

    applyTheme(theme) {
        const resolvedTheme = this.availableThemes.includes(theme) ? theme : 'theme-3';

        document.body.classList.remove(...this.bodyThemeClasses);
        if (this.bodyThemeClasses.includes(resolvedTheme)) {
            document.body.classList.add(resolvedTheme);
        }

        if (resolvedTheme !== theme) {
            localStorage.setItem(this.storageKey, resolvedTheme);
        }

        this.themeOptions.forEach(option => {
            option.classList.toggle('active', option.dataset.theme === resolvedTheme);
        });

        this.updateThemeSwitcherPreview();
    }

    updateThemeSwitcherPreview() {
        if (!this.themeSwitcherBtn) return;

        const computedStyle = getComputedStyle(document.body);
        const primary = computedStyle.getPropertyValue('--primary-color').trim();
        const secondary = computedStyle.getPropertyValue('--secondary-color').trim();
        const buttonText = computedStyle.getPropertyValue('--btn-text').trim() || '#ffffff';

        this.themeSwitcherBtn.style.background = `linear-gradient(145deg, ${primary}, ${secondary})`;
        this.themeSwitcherBtn.style.color = buttonText;
        this.themeSwitcherBtn.style.borderColor = 'transparent';
        this.themeSwitcherBtn.style.boxShadow = `0 10px 24px color-mix(in srgb, ${primary} 32%, transparent)`;
    }
}

class ReservationManager {
    constructor() {
        this.apiTimeoutMs = 12000;
        this.apiRetryCount = 2;
        this.storageKey = 'rahman_reservations';
        this.form = document.getElementById('reservationForm');
        this.tableSelect = document.getElementById('reservationTable');
        this.dateTimeInput = document.getElementById('reservationDateTime');
        this.availabilityText = document.getElementById('tableAvailabilityText');
        this.successText = document.getElementById('reservationSuccessText');
        this.whatsAppModeText = document.getElementById('reservationWhatsAppModeText');
        this.successModalElement = document.getElementById('reservationSuccessModal');
        this.reservationModalElement = document.getElementById('reservationModal');
        this.successModal = this.successModalElement
            ? new bootstrap.Modal(this.successModalElement)
            : null;
        this.reservationModal = this.reservationModalElement
            ? bootstrap.Modal.getOrCreateInstance(this.reservationModalElement)
            : null;
        this.reservations = this.getStoredReservations();
        this.init();
    }

    init() {
        if (!this.form || !this.tableSelect || !this.dateTimeInput) return;

        this.dateTimeInput.min = this.getMinDateTime();
        this.populateProfileDefaults();
        this.loadReservationsFromBackend().finally(() => {
            this.renderTableOptions();
        });

        this.dateTimeInput.addEventListener('change', () => this.renderTableOptions());
        this.tableSelect.addEventListener('change', () => this.updateAvailabilityText());
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    getStoredReservations() {
        return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
    }

    persistReservations() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.reservations));
    }

    getMinDateTime() {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    }

    normalizeSlot(value) {
        return String(value || '').trim();
    }

    renderTableOptions() {
        const slot = this.normalizeSlot(this.dateTimeInput.value);
        this.tableSelect.innerHTML = '<option value="">Select table</option>';

        for (let tableNumber = 1; tableNumber <= 50; tableNumber += 1) {
            const option = document.createElement('option');
            option.value = String(tableNumber);

            const occupied = this.reservations.some((reservation) => {
                return String(reservation.tableNumber) === String(tableNumber)
                    && this.normalizeSlot(reservation.dateTime) === slot;
            });

            option.textContent = occupied
                ? `Table ${tableNumber} (Reserved)`
                : `Table ${tableNumber} (Available)`;
            option.disabled = occupied;
            this.tableSelect.appendChild(option);
        }

        this.updateAvailabilityText();
    }

    updateAvailabilityText() {
        if (!this.availabilityText) return;
        const selected = this.tableSelect.options[this.tableSelect.selectedIndex];
        if (!selected || !selected.value) {
            this.availabilityText.textContent = 'Select date/time and table to view availability.';
            return;
        }
        this.availabilityText.textContent = selected.disabled
            ? 'This table is not available for the selected time.'
            : 'Table is available for reservation.';
    }

    getSession() {
        try {
            return JSON.parse(localStorage.getItem('rahman_auth_session') || 'null');
        } catch {
            return null;
        }
    }

    getApiBase() {
        const host = window.location.hostname;
        const productionApi = 'https://rahman-restaurant.onrender.com';
        if (!host || host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        return productionApi;
    }

    isNetworkFetchError(error) {
        if (!error) return false;
        const message = String(error.message || '').toLowerCase();
        return (
            error.name === 'TypeError'
            || error.name === 'AbortError'
            || message.includes('failed to fetch')
            || message.includes('networkerror')
            || message.includes('network request failed')
        );
    }

    wait(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    async fetchWithTimeout(url, options = {}, timeoutMs = this.apiTimeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal
            });
        } finally {
            clearTimeout(timer);
        }
    }

    async fetchJson(path, options = {}, retries = this.apiRetryCount) {
        let lastError = null;

        for (let attempt = 1; attempt <= retries; attempt += 1) {
            try {
                const response = await this.fetchWithTimeout(`${this.getApiBase()}${path}`, options);
                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data?.message || 'Reservation API unavailable');
                }

                return data;
            } catch (error) {
                lastError = error;

                const shouldRetry = this.isNetworkFetchError(error) && attempt < retries;
                if (shouldRetry) {
                    await this.wait(250 * attempt);
                    continue;
                }

                break;
            }
        }

        if (this.isNetworkFetchError(lastError)) {
            throw new Error('Reservation service is temporarily unreachable. Please try again in a moment.');
        }

        throw new Error(lastError?.message || 'Reservation API unavailable');
    }

    async loadReservationsFromBackend() {
        try {
            const session = this.getSession();
            const headers = {};
            if (session?.token) {
                headers.Authorization = `Bearer ${session.token}`;
            }

            const data = await this.fetchJson('/api/reservations', { headers });
            const remoteReservations = Array.isArray(data?.reservations)
                ? data.reservations.map((item) => ({
                    id: item.id ? `RES-${item.id}` : `RES-${Date.now()}`,
                    name: item.name,
                    email: item.email,
                    phone: item.phone,
                    dateTime: item.dateTime,
                    guests: Number(item.guests || 1),
                    tableNumber: Number(item.tableNumber || 0),
                    createdAt: item.createdAt || new Date().toISOString()
                }))
                : [];

            if (remoteReservations.length) {
                this.reservations = remoteReservations;
                this.persistReservations();
            }
        } catch {}
    }

    async saveToBackend(payload) {
        const session = this.getSession();
        const headers = { 'Content-Type': 'application/json' };
        if (session?.token) {
            headers.Authorization = `Bearer ${session.token}`;
        }

        return this.fetchJson('/api/reservations', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
    }

    openWhatsAppNotification(reservation) {
        const message = `New reservation: Table ${reservation.tableNumber} by ${reservation.name} at ${reservation.dateTime}. Guests: ${reservation.guests}, Phone: ${reservation.phone}`;
        const whatsappLink = `https://wa.me/7858062571?text=${encodeURIComponent(message)}`;
        window.open(whatsappLink, '_blank');
    }

    openWhatsAppLink(link, reservation, shouldOpenManual) {
        if (!shouldOpenManual) {
            return 'opted-out';
        }

        if (link && !reservation.whatsappDeliveredByApi) {
            window.open(link, '_blank');
            return 'manual-link-opened';
        }

        if (!reservation.whatsappDeliveredByApi) {
            this.openWhatsAppNotification(reservation);
            return 'manual-fallback-opened';
        }

        return 'auto-sent';
    }

    populateProfileDefaults() {
        const session = this.getSession();
        if (!session?.user) return;

        const nameField = document.getElementById('reservationName');
        const emailField = document.getElementById('reservationEmail');

        if (nameField && !nameField.value) {
            nameField.value = session.user.name || '';
        }

        if (emailField && !emailField.value) {
            emailField.value = session.user.email || '';
        }
    }

    async handleSubmit(event) {
        event.preventDefault();

        const payload = {
            name: (document.getElementById('reservationName')?.value || '').trim(),
            email: (document.getElementById('reservationEmail')?.value || '').trim(),
            phone: (document.getElementById('reservationPhone')?.value || '').trim(),
            dateTime: this.normalizeSlot(document.getElementById('reservationDateTime')?.value),
            guests: Number(document.getElementById('reservationGuests')?.value || 1),
            tableNumber: Number(document.getElementById('reservationTable')?.value || 0),
            whatsappOptIn: Boolean(document.getElementById('reservationWhatsAppOptIn')?.checked)
        };

        const isTaken = this.reservations.some((reservation) => {
            return Number(reservation.tableNumber) === Number(payload.tableNumber)
                && this.normalizeSlot(reservation.dateTime) === payload.dateTime;
        });

        if (isTaken) {
            this.updateAvailabilityText();
            alert('Selected table is already reserved for this time. Please choose another table.');
            return;
        }

        const reservationRecord = {
            id: `RES-${Date.now()}`,
            ...payload,
            whatsappDeliveredByApi: false,
            createdAt: new Date().toISOString()
        };

        let whatsappLink = '';
        let providerHint = '';
        let whatsAppMode = 'manual-fallback-opened';

        try {
            const backendResult = await this.saveToBackend(payload);
            if (backendResult?.reservation?.id) {
                reservationRecord.id = backendResult.reservation.id;
            }
            whatsappLink = backendResult?.whatsappLink || '';
            providerHint = String(backendResult?.providerHint || '');
            reservationRecord.whatsappDeliveredByApi = Boolean(
                backendResult?.whatsappDelivery?.admin?.sent ||
                backendResult?.whatsappDelivery?.customer?.sent
            );
        } catch {}

        this.reservations.push(reservationRecord);
        this.persistReservations();
        this.renderTableOptions();
        whatsAppMode = this.openWhatsAppLink(
            whatsappLink,
            reservationRecord,
            payload.whatsappOptIn
        );

        if (this.successText) {
            this.successText.textContent = `Table ${reservationRecord.tableNumber} is reserved for ${reservationRecord.name} on ${reservationRecord.dateTime}.`;
        }

        if (this.whatsAppModeText) {
            if (whatsAppMode === 'auto-sent') {
                this.whatsAppModeText.textContent = 'WhatsApp update was sent automatically.';
            } else if (whatsAppMode === 'opted-out') {
                this.whatsAppModeText.textContent = 'WhatsApp updates are turned off for this reservation.';
            } else if (providerHint) {
                this.whatsAppModeText.textContent = 'Automatic WhatsApp is off. We opened WhatsApp so you can send the message manually.';
            } else {
                this.whatsAppModeText.textContent = 'Automatic WhatsApp could not be confirmed. Please send manually if needed.';
            }
        }

        this.form.reset();
        this.dateTimeInput.min = this.getMinDateTime();
        this.renderTableOptions();
        this.populateProfileDefaults();

        if (this.reservationModal) {
            this.reservationModal.hide();
        }
        if (this.successModal) {
            this.successModal.show();
        }
    }
}

class HeaderSearchManager {
    constructor() {
        this.searchForm = document.querySelector('.site-header .header-search-form');
        this.searchInput = this.searchForm?.querySelector('.form-input');
        this.searchButton = this.searchForm?.querySelector('button');
        this.mobileBreakpoint = window.matchMedia('(max-width: 680px)');
        this.init();
    }

    init() {
        if (!this.searchForm || !this.searchButton || !this.searchInput) return;

        this.searchButton.addEventListener('click', (event) => {
            if (!this.mobileBreakpoint.matches) return;

            if (!this.searchForm.classList.contains('is-open')) {
                event.preventDefault();
                this.searchForm.classList.add('is-open');
                this.searchInput.focus();
                return;
            }

            const value = (this.searchInput.value || '').trim();
            if (!value) {
                event.preventDefault();
            }
        });

        this.searchInput.addEventListener('blur', () => {
            if (!this.mobileBreakpoint.matches) return;
            window.setTimeout(() => {
                this.searchForm.classList.remove('is-open');
            }, 120);
        });

        this.mobileBreakpoint.addEventListener('change', () => {
            if (!this.mobileBreakpoint.matches) {
                this.searchForm.classList.remove('is-open');
            }
        });

        document.addEventListener('click', (event) => {
            if (!this.mobileBreakpoint.matches) return;
            if (!this.searchForm.contains(event.target)) {
                this.searchForm.classList.remove('is-open');
            }
        });
    }
}

// Initialize cart manager
document.addEventListener('DOMContentLoaded', () => {
    new ThemeManager();
    new CartManager();
    new FavoritesManager();
    new HeaderSearchManager();
    new ReservationManager();
});

// ============================================
// SCROLL TO TOP BUTTON
// ============================================

class ScrollToTop {
    constructor() {
        this.button = document.querySelector('.scroll-to-top');
        if (!this.button) {
            this.createButton();
        }
        this.init();
    }

    createButton() {
        this.button = document.createElement('button');
        this.button.className = 'scroll-to-top';
        this.button.innerHTML = '<i class="fas fa-chevron-up"></i>';
        this.button.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(145deg, #ff8243, #ffbc00);
            color: white;
            border: none;
            cursor: pointer;
            display: none;
            justify-content: center;
            align-items: center;
            font-size: 20px;
            box-shadow: 0 4px 15px rgba(255, 130, 67, 0.3);
            transition: all 0.3s ease;
            z-index: 998;
        `;
        document.body.appendChild(this.button);
    }

    init() {
        window.addEventListener('scroll', () => this.toggleButton());
        this.button.addEventListener('click', () => this.scrollToTop());
    }

    toggleButton() {
        if (window.scrollY > 300) {
            this.button.style.display = 'flex';
        } else {
            this.button.style.display = 'none';
        }
    }

    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

// Initialize scroll to top
document.addEventListener('DOMContentLoaded', () => {
    new ScrollToTop();
});
