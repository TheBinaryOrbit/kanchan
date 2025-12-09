const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const  data = [
  {"name": "Aarav Mehta", "phoneNumber": "9123450001", "email": "aarav.mehta01@example.com"},
  {"name": "Ananya Singh", "phoneNumber": "8123450002", "email": "ananya.singh02@example.com"},
  {"name": "Rohan Kumar", "phoneNumber": "7123450003", "email": "rohan.kumar03@example.com"},
  {"name": "Priya Patel", "phoneNumber": "6123450004", "email": "priya.patel04@example.com"},
  {"name": "Vihaan Sharma", "phoneNumber": "9123450005", "email": "vihaan.sharma05@example.com"},
  {"name": "Simran Kaur", "phoneNumber": "8123450006", "email": "simran.kaur06@example.com"},
  {"name": "Aditya Rao", "phoneNumber": "7123450007", "email": "aditya.rao07@example.com"},
  {"name": "Neha Gupta", "phoneNumber": "6123450008", "email": "neha.gupta08@example.com"},
  {"name": "Kabir Jain", "phoneNumber": "9123450009", "email": "kabir.jain09@example.com"},
  {"name": "Isha Verma", "phoneNumber": "8123450010", "email": "isha.verma10@example.com"},
  {"name": "Krishna Nair", "phoneNumber": "7123450011", "email": "krishna.nair11@example.com"},
  {"name": "Meera Iyer", "phoneNumber": "6123450012", "email": "meera.iyer12@example.com"},
  {"name": "Sameer Desai", "phoneNumber": "9123450013", "email": "sameer.desai13@example.com"},
  {"name": "Sakshi Yadav", "phoneNumber": "8123450014", "email": "sakshi.yadav14@example.com"},
  {"name": "Arjun Bhatt", "phoneNumber": "7123450015", "email": "arjun.bhatt15@example.com"},
  {"name": "Diya Choudhary", "phoneNumber": "6123450016", "email": "diya.choudhary16@example.com"},
  {"name": "Dev Malhotra", "phoneNumber": "9123450017", "email": "dev.malhotra17@example.com"},
  {"name": "Tanya Reddy", "phoneNumber": "8123450018", "email": "tanya.reddy18@example.com"},
  {"name": "Nikhil Sinha", "phoneNumber": "7123450019", "email": "nikhil.sinha19@example.com"},
  {"name": "Ritika Roy", "phoneNumber": "6123450020", "email": "ritika.roy20@example.com"},
  {"name": "Ayaan Kapoor", "phoneNumber": "9123450021", "email": "ayaan.kapoor21@example.com"},
  {"name": "Mira Sharma", "phoneNumber": "8123450022", "email": "mira.sharma22@example.com"},
  {"name": "Shiv Verma", "phoneNumber": "7123450023", "email": "shiv.verma23@example.com"},
  {"name": "Pooja Singh", "phoneNumber": "6123450024", "email": "pooja.singh24@example.com"},
  {"name": "Kabir Mehta", "phoneNumber": "9123450025", "email": "kabir.mehta25@example.com"},
  {"name": "Anika Rao", "phoneNumber": "8123450026", "email": "anika.rao26@example.com"},
  {"name": "Raghav Iyer", "phoneNumber": "7123450027", "email": "raghav.iyer27@example.com"},
  {"name": "Sanya Malhotra", "phoneNumber": "6123450028", "email": "sanya.malhotra28@example.com"},
  {"name": "Aryan Gupta", "phoneNumber": "9123450029", "email": "aryan.gupta29@example.com"},
  {"name": "Kiara Jain", "phoneNumber": "8123450030", "email": "kiara.jain30@example.com"},
  {"name": "Rudra Yadav", "phoneNumber": "7123450031", "email": "rudra.yadav31@example.com"},
  {"name": "Ayesha Sharma", "phoneNumber": "6123450032", "email": "ayesha.sharma32@example.com"},
  {"name": "Vivaan Bhatt", "phoneNumber": "9123450033", "email": "vivaan.bhatt33@example.com"},
  {"name": "Anvi Choudhary", "phoneNumber": "8123450034", "email": "anvi.choudhary34@example.com"},
  {"name": "Rohan Malhotra", "phoneNumber": "7123450035", "email": "rohan.malhotra35@example.com"},
  {"name": "Diya Reddy", "phoneNumber": "6123450036", "email": "diya.reddy36@example.com"},
  {"name": "Krish Sinha", "phoneNumber": "9123450037", "email": "krish.sinha37@example.com"},
  {"name": "Ira Roy", "phoneNumber": "8123450038", "email": "ira.roy38@example.com"},
  {"name": "Aarush Kapoor", "phoneNumber": "7123450039", "email": "aarush.kapoor39@example.com"},
  {"name": "Myra Sharma", "phoneNumber": "6123450040", "email": "myra.sharma40@example.com"},
  {"name": "Devansh Verma", "phoneNumber": "9123450041", "email": "devansh.verma41@example.com"},
  {"name": "Tara Singh", "phoneNumber": "8123450042", "email": "tara.singh42@example.com"},
  {"name": "Raghav Mehta", "phoneNumber": "7123450043", "email": "raghav.mehta43@example.com"},
  {"name": "Naina Rao", "phoneNumber": "6123450044", "email": "naina.rao44@example.com"},
  {"name": "Ayaan Iyer", "phoneNumber": "9123450045", "email": "ayaan.iyer45@example.com"},
  {"name": "Mahi Malhotra", "phoneNumber": "8123450046", "email": "mahi.malhotra46@example.com"},
  {"name": "Karan Gupta", "phoneNumber": "7123450047", "email": "karan.gupta47@example.com"},
  {"name": "Isha Jain", "phoneNumber": "6123450048", "email": "isha.jain48@example.com"},
  {"name": "Arya Yadav", "phoneNumber": "9123450049", "email": "arya.yadav49@example.com"},
  {"name": "Ritika Sharma", "phoneNumber": "8123450050", "email": "ritika.sharma50@example.com"}
]


async function createCustomers(count = 50) {
  const created = [];
  for (let i = 0; i < count; i++) {

    // Do NOT set uid — let DB generate uid via default dbgenerated expression
    const customer = await prisma.customer.create({
      data: {
        name : data[i].name,
        phone   : data[i].phoneNumber,
        email   : data[i].email,
        address : '123 | Sample Street |  City | Bihar'
      }
    });

    created.push(customer);
    if ((i + 1) % 10 === 0) console.log(`Created ${i + 1} customers`);
  }

  return created;
}

async function main() {
  try {
    const customers = await createCustomers(50);
    console.log(`Seeding complete. Total customers created: ${customers.length}`);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();