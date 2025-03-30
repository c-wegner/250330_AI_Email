// Function to write client contacts to localStorage
//@ts-nocheck

function writeClientsToLocalStorage() {

      // Check if clients already exist in localStorage
      const existingClientsData = localStorage.getItem('clientBook');
    
      // If clients already exist, don't overwrite them
      if (existingClientsData && JSON.parse(existingClientsData).length > 0) {
          console.log("Clients already exist in localStorage. Skipping import.");
          return JSON.parse(existingClientsData);
      }
    // Format the clients correctly
    const clients = [];
    
    const contactData = [
        { name: "Pathformance Technologies Inc.", email: "elizabeth@pathformance.com", entity: "Company" },
        { name: "Evan DiLeonardi", email: "evandileonardi1@gmail.com", entity: "Person" },
        { name: "Billy Lyell", email: "lyellboxing@gmail.com", entity: "Person" },
        { name: "Adam Quint", email: "adamq4491@gmail.com", entity: "Person" },
        { name: "Catalyst", email: "adam@catalystcommgroup.com", entity: "Company" },
        { name: "Cate Nelson", email: "cate.ortman@gmail.com", entity: "Person" },
        { name: "Tanner Tibbits", email: "tannertibbits@gmail.com", entity: "Person" },
        { name: "American Waste Holdings LLC", email: "gnieto@rascoklock.com", entity: "Company" },
        { name: "Naturipe Farms LLC", email: "abeck@naturipefarms.com", entity: "Company" },
        { name: "Joeseph Gartland", email: "joegartland@gmail.com", entity: "Person" },
        { name: "THE L.L. CLEAN COMPANY", email: "joegartland@gmail.com", entity: "Company" },
        { name: "Deliberate Reach Media", email: "miesha@minnesotajobs.com", entity: "Company" },
        { name: "Nathan Goebel", email: "nathangoebel@forecastnow.onmicrosoft.com", entity: "Person" },
        { name: "Julio Nieto", email: "janietomd@protonmail.com", entity: "Person" },
        { name: "Jeffery Bartlett", email: "steve@neptunetech.io", entity: "Person" },
        { name: "Marissa Collins", email: "marissalynncollins3@gmail.com", entity: "Person" },
        { name: "Evan Elliot", email: "elliott.evanm@gmail.com", entity: "Person" },
        { name: "JNR Acquistions LLC", email: "jmt5049@gmail.com", entity: "Company" },
        { name: "Carlene Rimes", email: "carlyrimes@mobilerehabfl.com", entity: "Person" },
        { name: "idMatch", email: "justin@idmatch.ai", entity: "Company" },
        { name: "Neptune Technologies LLC", email: "joe@neptunetech.io", entity: "Company" },
        { name: "Josh Pendrick", email: "joshpendrick@gmail.com", entity: "Person" },
        { name: "Scott Fuchs", email: "scottf.do@gmail.com", entity: "Person" },
        { name: "Jonathan Turner", email: "jmt5049@gmail.com", entity: "Person" },
        { name: "Nadine Pou", email: "poumarcia@gmail.com", entity: "Person" },
        { name: "Solar Grids LLC", email: "justin@solargrids.com", entity: "Company" },
        { name: "Roger Hecht", email: "rogerdhecht@gmail.com", entity: "Person" },
        { name: "Ryan Lund", email: "ryan@lundcapital.com", entity: "Person" },
        { name: "Sarina's Desserts Inc.", email: "flacoschips@gmail.com", entity: "Company" },
        { name: "Mac Marrone", email: "macmarrone@gmail.com", entity: "Person" },
        { name: "Wegner Law PLLC", email: "cwegner@wegnerlawfirm.com", entity: "Company" },
        { name: "Valor Studios Inc.", email: "staff@valorstudios.com", entity: "Company" },
        { name: "GEM Technologies", email: "brian@gemconsulting.net", entity: "Company" },
        { name: "Travis Aller", email: "travis.aller@gmail.com", entity: "Person" },
        { name: "Jim Scull", email: "sculljr@gmail.com", entity: "Person" },
        { name: "Mende Willams", email: "mende@loveyogacenter.com", entity: "Person" },
        { name: "Scott Hoffner", email: "hoffnersnursery@gmail.com", entity: "Person" },
        { name: "Brad Lewis", email: "bradlewis1984@gmail.com", entity: "Person" },
        { name: "Gary Goodman", email: "cabG49@aol.com", entity: "Person" },
        { name: "Forest Rampert", email: "bonjour19732008@gmail.com", entity: "Person" },
        { name: "DeCordia Development LLC", email: "matt@flestatelaw.com", entity: "Company" },
        { name: "Lighthouse Capital Group LLC", email: "ben@benkelly.co", entity: "Company" },
        { name: "Snya Bhatia-Borer", email: "sonyabhatiaborer@gmail.com", entity: "Person" },
        { name: "Rina Kupferschmid-Rojas", email: "rina.kupferschmid@gmail.com", entity: "Person" },
        { name: "Randell Sussman", email: "randy@pb1965.com", entity: "Person" },
        { name: "Adam Makos", email: "adamm1941@gmail.com", entity: "Person" },
        { name: "Scott Zubricky", email: "scotthdsport@aol.com", entity: "Person" },
        { name: "Zak Normandin", email: "zak.normandin@gmail.com", entity: "Person" },
        { name: "Kyle Sondermeyer", email: "aecks76@yahoo.com", entity: "Person" },
        { name: "Brett Kuziak", email: "brett@profileaw.com", entity: "Person" },
        { name: "Lisa Green", email: "lisa@lginteriordesign.com", entity: "Person" },
        { name: "Phil Wong", email: "philw007@gmail.com", entity: "Person" },
        { name: "Luis Casas", email: "jplcfoodtruck@gmail.com", entity: "Person" },
        { name: "Linda Lovelace", email: "ntlmed@aol.com", entity: "Person" },
        { name: "Jason Driskel", email: "jdriskel@bkufinancial.com", entity: "Person" },
        { name: "Jennifer Tucker", email: "jennifertuc@icloud.com", entity: "Person" },
        { name: "Harbormaster International Inc.", email: "casey@harbormasters.com", entity: "Company" },
        { name: "Jennifer Doino", email: "rjnadjr@aol.com", entity: "Person" },
        { name: "Kasey Converse", email: "kaseyconverse@gmail.com", entity: "Person" },
        { name: "James Davidson", email: "jdavidson@dncpas.com", entity: "Person" },
        { name: "Micheal Binner", email: "drmbinner@gmail.com", entity: "Person" },
        { name: "Eagle 7 Productions Inc.", email: "adamm1941@gmail.com", entity: "Company" },
        { name: "S-FUND-001 LLC", email: "mitch@soldfast.com", entity: "Company" },
        { name: "Micheal Morr", email: "morr1@maine.rr.com", entity: "Person" },
        { name: "Miranda Landry", email: "mlandry1017@icloud.com", entity: "Person" },
        { name: "Jacki Carmichael", email: "jrcarmi@32acquisitions.com", entity: "Person" },
        { name: "Brian Iacaponi", email: "brian@ncv.org", entity: "Person" },
        { name: "Shannon Lackey", email: "shannon@lginteriordesign.com", entity: "Person" },
        { name: "Matthew Bergwell", email: "mbergwall2222@gmail.com", entity: "Person" },
        { name: "Jennifer Smith", email: "donnarbryan8945@gmail.com", entity: "Person" },
        { name: "PAUL JAYMES FLORIDA LLC", email: "tonim@seriouslyaddictivemath.com", entity: "Company" },
        { name: "Kova Foundation", email: "lemma@kovafoundation.org", entity: "Company" },
        { name: "Big Jay's Mobile Detailing", email: "jprodetailing@gmail.com", entity: "Company" },
        { name: "Aaron Omdoll", email: "aaronomdoll@protonmail.com", entity: "Person" },
        { name: "Aaron Omdoll", email: "aaronomdoll@pm.me", entity: "Person" },
        { name: "Zane McMinn", email: "mcminnzane@gmail.com", entity: "Person" },
        { name: "Hill Boggess", email: "chb83jd@icloud.com", entity: "Person" },
        { name: "Ben Moroschan", email: "benjamin.moroschan@pm.me", entity: "Person" },
        { name: "Mark Spera", email: "mark@growthmarketingpro.com", entity: "Person" },
        { name: "Hailey Friedman", email: "hailey@growthmarketingpro.com", entity: "Person" },
        { name: "Todd Sondrini", email: "tsondrini@transatl.com", entity: "Person" },
        { name: "David Call", email: "david.call007@yahoo.com", entity: "Person" },
        { name: "Transatlantic GSP LLC", email: "TSondrini@transatl.com", entity: "Company" },
        { name: "Mac Lane", email: "lanemac22@gmail.com", entity: "Person" },
        { name: "Kate Freudeman", email: "kfreudeman@gmail.com", entity: "Person" },
        { name: "Aiello Cooper", email: "cooper@bizzy-deals.com", entity: "Person" },
        { name: "Vlue", email: "ron@vlue.com", entity: "Company" },
        { name: "Jeff Deutmeyer", email: "jeff@vmcclaim.com", entity: "Person" },
        { name: "Duane Massie", email: "damassie@gmail.com", entity: "Person" },
        { name: "Mary Moses", email: "moses.mary0409@gmail.com", entity: "Person" },
        { name: "Shayna Cavanaugh", email: "shayna@cavanaughattorneys.com", entity: "Person" },
        { name: "Dan Rak", email: "dan@danrakdesign.com", entity: "Person" },
        { name: "Brian Fowler", email: "bfowler@swpropmgt.com", entity: "Person" },
        { name: "Skip Sorenson", email: "skip.sorenson@sorfam.com", entity: "Person" },
        { name: "Centarus Companies", email: "lamatucci@centarusps.com", entity: "Company" },
        { name: "Vintara Trading Ltd.", email: "cypher@vintaratrading.com", entity: "Company" },
        { name: "Sycamore Construction LLC", email: "ngilliom@sycamoreconstruction.biz", entity: "Company" },
        { name: "Shirlene Elkins", email: "shirleneelkins@gmail.com", entity: "Person" },
        { name: "Daniel Zuvia", email: "dzuvia9@gmail.com", entity: "Person" },
        { name: "Premier Private Home Care Corp.", email: "premierprivatehccorp@gmail.com", entity: "Company" },
        { name: "Timmothy Gammons", email: "drgammons@gammonsmedical.com", entity: "Person" },
        { name: "John Garrels", email: "john.garrels@aussiepetmobile.com", entity: "Person" },
        { name: "Oliver Chalk", email: "oliver@continuumtrading.xyz", entity: "Person" },
        { name: "Diana Becker", email: "dianabecker123@comcast.net", entity: "Person" },
        { name: "Dannie Stylist", email: "danniestylist@gmail.com", entity: "Person" },
        { name: "Miklos Van Halen", email: "miklosvh@pm.me", entity: "Person" },
        { name: "Gieta Leslie Sistla", email: "lsistla@hotmail.com", entity: "Person" },
        { name: "Theodore Wynn", email: "twynn@mdtelectric.com", entity: "Person" },
        { name: "Chatt Transportation Services LLC", email: "rskulina@fl-office.com", entity: "Company" },
        { name: "Alan Stein", email: "alan@sellsmartstrategies.com", entity: "Person" },
        { name: "Albert Alessi", email: "doc@alessifamilycare.com", entity: "Person" },
        { name: "Priscilla Schertell", email: "priscilla.schertell@gmail.com", entity: "Person" },
        { name: "eilif mikkelsen", email: "kb1nyq@gmail.com", entity: "Person" },
        { name: "Lund Capital LLC", email: "jim@lundcapital.com", entity: "Company" },
        { name: "Randy Snow", email: "rsnow@snowprivatewealth.com", entity: "Person" },
        { name: "Todd Taus", email: "todd@tazpmi.com", entity: "Person" },
        { name: "Jason Miner", email: "jasonkminer@gmail.com", entity: "Person" },
        { name: "Ariel Hernandez", email: "Hernandez1972.ah@gmail.com", entity: "Person" },
        { name: "Cory Lamar", email: "cdlamar2@gmail.com", entity: "Person" },
        { name: "Elliot Reel", email: "elliott@sprouttherapysolutions.com", entity: "Person" },
        { name: "Cloud Title", email: "thomas@cloudtitle.com", entity: "Company" },
        { name: "Derek Fanucci", email: "derekfanucci@gmail.com", entity: "Person" },
        { name: "Steven DeRoso", email: "Derosoholdings@gmail.com", entity: "Person" },
        { name: "Julie Koester", email: "jwk@dragonhorseagency.com", entity: "Person" },
        { name: "Janet Polito", email: "spajp41@gmail.com", entity: "Person" },
        { name: "Daniel Beyar", email: "dbeyar924@gmail.com", entity: "Person" },
        { name: "Chris Dosen", email: "chris.dosen@gmail.com", entity: "Person" },
        { name: "Brent Johnson", email: "brent@brentajohnson.com", entity: "Person" },
        { name: "Adam Brunet", email: "abrunet@vmcclaim.com", entity: "Person" },
        { name: "Cypher Holdings Inc.", email: "cypher@0xcypher.com", entity: "Company" },
        { name: "Steven Palmisano", email: "steve@adelevate.com", entity: "Person" },
        { name: "Lauren Hudak", email: "laurenhudak@yahoo.com", entity: "Person" },
        { name: "Jeffery Oliphant", email: "jeff@jwoliphant.com", entity: "Person" },
        { name: "Michael Wian", email: "michael@fortmyerscyclery.com", entity: "Person" },
        { name: "Chris Barnhart", email: "christopher.c.barnhart@gmail.com", entity: "Person" },
        { name: "Devab Miller", email: "devan@versomnia.io", entity: "Person" },
        { name: "Beth Harvey", email: "kais75@aol.com", entity: "Person" },
        { name: "Alexx Leyva", email: "alexxleyva@gmail.com", entity: "Person" },
        { name: "Don Linzy", email: "donrlinzy@gmail.com", entity: "Person" },
        { name: "Paul Sanchez", email: "psimage@me.com", entity: "Person" },
        { name: "Jake Rothschiller", email: "sandrsealcoatingandpaving@gmail.com", entity: "Person" },
        { name: "Brandon Leyva", email: "brandon@nomaresorts.com", entity: "Person" },
        { name: "Carl Best", email: "carlbest223@gmail.com", entity: "Person" },
        { name: "Elite Supply Chain Services", email: "rskulina@fl-office.com", entity: "Company" },
        { name: "Mari Mathews", email: "marimathews@gmail.com", entity: "Person" },
        { name: "Gloria Davies", email: "gloriacdavies@gmail.com", entity: "Person" },
        { name: "Edward Bourtros", email: "edboutros@sbcglobal.net", entity: "Person" },
        { name: "Eric Anderson", email: "eric@andersonem.net", entity: "Person" },
        { name: "Diana O'Halloran", email: "hhmnaples@yahoo.com", entity: "Person" },
        { name: "Kevin Oomah", email: "kevinoomah@gmail.com", entity: "Person" },
        { name: "Bespoke Beans", email: "travis.cozzie@gmail.com", entity: "Company" },
        { name: "William Oberton", email: "wdoberton@gmail.com", entity: "Person" },
        { name: "Ryan Pipin", email: "naplescreens@yahoo.com", entity: "Person" },
        { name: "Gulfshore Private Home Care, LLC", email: "brandon@gulfshorecare.com", entity: "Company" },
        { name: "Andy Friedl", email: "legala09@gmail.com", entity: "Person" },
        { name: "Daman Essert", email: "daman1983@hotmail.com", entity: "Person" },
        { name: "Noe Rodriguez", email: "rod.alberto25@gmail.com", entity: "Person" },
        { name: "Zachery M. Evans", email: "zevans89@icloud.com", entity: "Person" },
        { name: "Steven Biafore", email: "biaforesteven@gmail.com", entity: "Person" },
        { name: "aurelie banoun", email: "aurelie.banoun@gmail.com", entity: "Person" },
        { name: "Steve Rambow", email: "steve@neptunetech.io", entity: "Person" },
        { name: "Jennifer Getman", email: "jennifergetman@hotmail.com", entity: "Person" },
        { name: "Zachery Getman", email: "zachget@yahoo.com", entity: "Person" }
    ];
    
    // Process each contact
    contactData.forEach(contact => {
      const fileAs = contact.entity === "Company" 
        ? contact.name 
        : formatPersonName(contact.name);
        
      const client = {
        uid: generateUID(),
        name: contact.name,
        file_as: fileAs,
        emails: [contact.email], // Now using an array of email strings
        phone: "",
        description: `${contact.entity} client`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "active",
        referal_source: ""
      };
      
      clients.push(client);
    });
    
    // Sort clients by file_as
    clients.sort((a, b) => a.file_as.localeCompare(b.file_as));
    
    // Save to localStorage
    localStorage.setItem('clientBook', JSON.stringify(clients));
    console.log(`Saved ${clients.length} clients to localStorage`);
    
    return clients;
  }
  
  // Helper to format person names as "LastName, FirstName"
  function formatPersonName(name) {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return name;
    
    const lastName = parts.pop();
    const firstName = parts.join(' ');
    return `${lastName}, ${firstName}`;
  }
  
  // Generate a simple UID
  function generateUID() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  writeClientsToLocalStorage()
  
  // Call this function once in your application startup code
  // writeClientsToLocalStorage();