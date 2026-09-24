const complaint =
  document.getElementById("complaint");

const count =
  document.getElementById("count");

if (complaint) {

  complaint.addEventListener("input", () => {

    count.innerText =
      complaint.value.length;

  });

}


const form =
  document.getElementById("complaintForm");


if (form) {

  form.addEventListener("submit", function(e) {

    e.preventDefault();


    const name =
      document.getElementById("name").value;

    const text =
      document.getElementById("complaint").value;


    if (!name || !text) {

      alert("Please fill all required fields.");

      return;

    }


    /*
      DEMO AI CLASSIFICATION

      Later this section can be connected
      to your Python AI backend.
    */

    let category = "General";
    let department = "Citizen Services Department";
    let priority = "NORMAL";
    let eta = "3 - 5 Days";


    const message =
      text.toLowerCase();


    if (
      message.includes("electricity") ||
      message.includes("light") ||
      message.includes("power")
    ) {

      category = "Electricity";
      department = "Electricity Department";

    }

    else if (
      message.includes("water") ||
      message.includes("pipeline") ||
      message.includes("tap")
    ) {

      category = "Water";
      department = "Water Supply Department";

    }

    else if (
      message.includes("road") ||
      message.includes("pothole")
    ) {

      category = "Roads";
      department = "Municipal Roads Department";

    }

    else if (
      message.includes("hospital") ||
      message.includes("doctor") ||
      message.includes("medicine")
    ) {

      category = "Healthcare";
      department = "Health Department";

    }

    else if (
      message.includes("school") ||
      message.includes("college") ||
      message.includes("teacher")
    ) {

      category = "Education";
      department = "Education Department";

    }


    if (
      message.includes("urgent") ||
      message.includes("emergency") ||
      message.includes("danger") ||
      message.includes("accident")
    ) {

      priority = "CRITICAL";
      eta = "Within 24 Hours";

    }

    else if (
      message.includes("not working") ||
      message.includes("failed") ||
      message.includes("problem")
    ) {

      priority = "HIGH";
      eta = "2 - 3 Days";

    }


    const ticket =
      "GRV-" +
      new Date().getFullYear() +
      "-" +
      Math.floor(10000 + Math.random() * 90000);


    document.getElementById("ticketId")
      .innerText = ticket;

    document.getElementById("category")
      .innerText = category;

    document.getElementById("department")
      .innerText = department;

    document.getElementById("priority")
      .innerText = priority;

    document.getElementById("eta")
      .innerText = eta;


    document.getElementById("resultCard")
      .classList.remove("hidden");


    document.getElementById("resultCard")
      .scrollIntoView({
        behavior: "smooth"
      });

  });

}