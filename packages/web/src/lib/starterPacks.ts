export interface StarterPackItem {
  itemName: string;
  quantity: number;
  unit?: string;
}

export interface StarterPack {
  id: string;
  emoji: string;
  nameEn: string;
  nameLt: string;
  descEn: string;
  descLt: string;
  items: StarterPackItem[];
}

export const STARTER_PACKS: StarterPack[] = [
    {
    id: "lithuanian-classic",
    emoji: "🇱🇹",
    nameEn: "Lithuanian Classic",
    nameLt: "Lietuviška virtuvė",
    descEn: "Traditional Lithuanian weekly shopping",
    descLt: "Tradicinis lietuviškas savaitės pirkinių sąrašas",
    items: [
      { itemName: "rye bread", quantity: 1 },
      { itemName: "pienas", quantity: 2 },
      { itemName: "sviestas", quantity: 1 },
      { itemName: "varškė", quantity: 1 },
      { itemName: "grietinė", quantity: 1 },
      { itemName: "kiaušiniai", quantity: 10 },
      { itemName: "bulvės", quantity: 1 },
      { itemName: "kopūstai", quantity: 1 },
      { itemName: "morkos", quantity: 1 },
      { itemName: "svogūnai", quantity: 1 },
      { itemName: "kiauliena", quantity: 1 },
      { itemName: "grūdėta garstyčia", quantity: 1 },
    ],
  },
  {
    id: "student-survival",
    emoji: "🎓",
    nameEn: "Student Survival",
    nameLt: "Studento rinkinys",
    descEn: "Budget-friendly weekly basics",
    descLt: "Pigūs savaitės produktai",
    items: [
      { itemName: "pasta", quantity: 1 },
      { itemName: "rice", quantity: 1 },
      { itemName: "eggs", quantity: 10 },
      { itemName: "bread", quantity: 1 },
      { itemName: "milk", quantity: 1 },
      { itemName: "butter", quantity: 1 },
      { itemName: "cheese", quantity: 1 },
      { itemName: "chicken", quantity: 1 },
      { itemName: "potatoes", quantity: 1 },
      { itemName: "onion", quantity: 1 },
      { itemName: "tomatoes", quantity: 1 },
      { itemName: "sunflower oil", quantity: 1 },
      { itemName: "coffee", quantity: 1 },
      { itemName: "sugar", quantity: 1 },
      { itemName: "salt", quantity: 1 },
    ],
  },
  {
    id: "vegan-starter",
    emoji: "🥗",
    nameEn: "Vegan Starter",
    nameLt: "Veganiško gyvenimo pradžia",
    descEn: "Plant-based essentials",
    descLt: "Augalinės kilmės produktai",
    items: [
      { itemName: "oat milk", quantity: 1 },
      { itemName: "tofu", quantity: 1 },
      { itemName: "lentils", quantity: 1 },
      { itemName: "chickpeas", quantity: 1 },
      { itemName: "spinach", quantity: 1 },
      { itemName: "broccoli", quantity: 1 },
      { itemName: "avocado", quantity: 1 },
      { itemName: "whole grain bread", quantity: 1 },
      { itemName: "olive oil", quantity: 1 },
      { itemName: "rice", quantity: 1 },
      { itemName: "banana", quantity: 1 },
      { itemName: "apple", quantity: 1 },
      { itemName: "nuts", quantity: 1 },
    ],
  },
  {
    id: "indian-basics",
    emoji: "🍛",
    nameEn: "Indian Basics",
    nameLt: "Indiška virtuvė",
    descEn: "Spices and staples for Indian cooking",
    descLt: "Prieskoniai ir produktai indiškai virtuvei",
    items: [
      { itemName: "basmati rice", quantity: 1 },
      { itemName: "lentils", quantity: 1 },
      { itemName: "chickpeas", quantity: 1 },
      { itemName: "onion", quantity: 1 },
      { itemName: "garlic", quantity: 1 },
      { itemName: "ginger", quantity: 1 },
      { itemName: "tomatoes", quantity: 1 },
      { itemName: "yogurt", quantity: 1 },
      { itemName: "vegetable oil", quantity: 1 },
      { itemName: "cumin", quantity: 1 },
      { itemName: "turmeric", quantity: 1 },
      { itemName: "coriander", quantity: 1 },
      { itemName: "chili pepper", quantity: 1 },
      { itemName: "garam masala", quantity: 1 },
    ],
  },
  {
    id: "ukrainian-comfort",
    emoji: "🍲",
    nameEn: "Ukrainian Comfort",
    nameLt: "Ukrainietiška virtuvė",
    descEn: "Eastern European comfort food staples",
    descLt: "Rytų Europos namų maisto produktai",
    items: [
      { itemName: "buckwheat", quantity: 1 },
      { itemName: "potatoes", quantity: 1 },
      { itemName: "onion", quantity: 1 },
      { itemName: "carrots", quantity: 1 },
      { itemName: "beet", quantity: 1 },
      { itemName: "cabbage", quantity: 1 },
      { itemName: "pork", quantity: 1 },
      { itemName: "sunflower oil", quantity: 1 },
      { itemName: "sour cream", quantity: 1 },
      { itemName: "dill", quantity: 1 },
      { itemName: "tomato paste", quantity: 1 },
      { itemName: "bread", quantity: 1 },
      { itemName: "eggs", quantity: 6 },
    ],
  },
  {
    id: "halal-essentials",
    emoji: "🥩",
    nameEn: "Halal Essentials",
    nameLt: "Halal rinkinys",
    descEn: "Halal-friendly weekly groceries",
    descLt: "Halal savaitės produktai",
    items: [
      { itemName: "chicken", quantity: 1 },
      { itemName: "rice", quantity: 1 },
      { itemName: "lentils", quantity: 1 },
      { itemName: "olive oil", quantity: 1 },
      { itemName: "garlic", quantity: 1 },
      { itemName: "onion", quantity: 1 },
      { itemName: "tomatoes", quantity: 1 },
      { itemName: "yogurt", quantity: 1 },
      { itemName: "bread", quantity: 1 },
      { itemName: "cumin", quantity: 1 },
      { itemName: "milk", quantity: 1 },
      { itemName: "eggs", quantity: 6 },
    ],
  }
];
