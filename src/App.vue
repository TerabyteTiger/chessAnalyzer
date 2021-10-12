<template>
  <div class="min-h-screen flex flex-col dark:bg-gray-800 dark:text-white">
    <h1 class="text-4xl mb-6 pt-6">
      Quick Chess Analysis <button @click="toggleTheme">{{ themeText }}</button>
    </h1>

    <div class="container mx-auto flex-grow">
      <form
        @submit.prevent="buttonData"
        class="flex flex-col mx-auto max-w-md mb-6"
      >
        <label for="formatSelect" class="text-xl">Formats to include:</label>
        <p><b>Tip:</b> <kbd>Ctrl</kbd> + Click or drag to select multiples</p>
        <select
          v-model="format"
          multiple
          id="formatSelect"
          class="
            border-4
            p-2
            rounded
            border-yellow-300
            text-yellow-800
            overflow-hidden
          "
        >
          <option value="rapid">rapid</option>
          <option value="bullet">bullet</option>
          <option value="blitz" class="selected:bg-red-300">blitz</option>
        </select>
        <label for="bucketSize" class="text-xl"
          >Round Ratings to nearest:</label
        >
        <input
          type="number"
          v-model="bucketSize"
          min="1"
          id="bucketSize"
          class="border-4 p-2 rounded border-red-300 text-red-800"
          title="Ratings are rounded to the nearest value, up or down. This way a 1249 will count as a 1250 instead of a 1200 for example. For best results keep this below 200"
          required
          @focus="$event.target.select()"
        />
        <label for="monthsBack" class="text-xl"
          >Number of months to review:</label
        >
        <input
          type="number"
          v-model="userMonths"
          step="1"
          min="0"
          id="monthsBack"
          class="border-4 p-2 rounded border-green-300 text-green-800"
          title="Number of months to include in report, including current month to date (Enter 0 for current month to date stats)"
          @focus="$event.target.select()"
          required
        />
        <label for="userName" class="text-xl">Your Chess.com Username</label>
        <input
          class="border-4 p-2 rounded border-purple-300 text-purple-800"
          type="text"
          v-model="user"
          id="userName"
          @focus="$event.target.select()"
          required
        />
        <br />
        <button
          class="
            border-4
            p-2
            rounded
            border-blue-300
            text-blue-800
            hover:text-white hover:bg-blue-800
            dark:bg-blue-100 dark:hover:bg-blue-800
          "
        >
          {{ loading ? "Loading..." : btnText }}
        </button>
      </form>
      <p v-if="totalgames">Games analyzed: {{ totalgames - droppedgames }}</p>

      <!-- Wins by bucket - Both Colors -->
      <div v-if="Chart.getChart('netWins')">
        <h2 class="text-3xl mt-6">Wins, Losses, & Draws by color/rating</h2>
        <p>
          <b>Tip: </b>You can show/hide data by clicking the labels in the
          legend
        </p>
      </div>
      <canvas
        id="bothColors"
        :class="Chart.getChart('bothColors') ? '' : 'hidden'"
      ></canvas>

      <h2 v-if="Chart.getChart('netWins')" class="text-3xl mt-6">
        Net Wins by color/rating
      </h2>
      <canvas
        id="netWins"
        :class="Chart.getChart('netWins') ? '' : 'hidden'"
      ></canvas>
    </div>
    <footer class="bg-purple-100 mt-6 p-6 bottom-0 dark:bg-purple-900">
      Built by TerabyteTiger |
      <a
        href="https://twitter.com/terabytetiger"
        class="border-b-4 border-blue-500 border-dashed md:pb-1"
        >Twitter</a
      >
      |
      <a
        href="https://chess.terabytetiger.com"
        class="border-b-4 border-green-500 border-dashed md:pb-1"
        >Chess</a
      >
      |
      <a
        href="https://terabytetiger.com"
        class="border-b-4 border-pink-500 border-dashed md:pb-1"
        >Development</a
      >
      |
      <a
        href="https://github.com/TerabyteTiger/chessAnalyzer"
        class="border-b-4 border-indigo-500 border-dashed md:pb-1"
        >Contribute</a
      >
      <br />
    </footer>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import axios from "axios";
import Chart from "chart.js/auto";

let now = ref(new Date());
const user = ref("terabytetiger");
let url = computed(() => {
  return (
    "https://api.chess.com/pub/player/" +
    user.value +
    "/games/" +
    now.value.getFullYear() +
    "/" +
    ("" + (now.value.getMonth() + 1)).padStart(2, "0")
  );
});

let resp = ref();
let loading = ref(false);
let btnText = ref("Get Games");
let defaultTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";
let theme = ref(defaultTheme);
let themeText = ref(defaultTheme === "light" ? "🌞" : "🌙");
// set default theme lol
document.getElementById("app").className = theme.value;
const toggleTheme = () => {
  if (theme.value === "light") {
    themeText.value = "🌙";
    theme.value = "dark";
    document.getElementById("app").className = "dark";
    if (Chart.getChart("netWins")) {
      winsChart.update();
      netChart.update();
    }
  } else {
    themeText.value = "🌞";
    theme.value = "light";
    document.getElementById("app").className = "light";
    winsChart.update();
    if (Chart.getChart("netWins")) {
      winsChart.update();
      netChart.update();
    }
  }
};

let userMonths = ref(12);
let monthsToAnalyze = 12;

let dataset = ref({
  black: {
    wins: {},
    losses: {},
    draws: {},
  },
  white: {
    wins: {},
    losses: {},
    draws: {},
  },
});

const format = ref(["rapid"]);
let totalgames = ref(0);
let droppedgames = ref(0);
let bucketSize = ref(100);

const buttonData = () => {
  loading.value = true;
  dataset.value = {
    black: {
      wins: {},
      losses: {},
      draws: {},
    },
    white: {
      wins: {},
      losses: {},
      draws: {},
    },
  };
  totalgames.value = 0;
  droppedgames.value = 0;
  monthsToAnalyze = userMonths.value;
  now.value = new Date();
  getData();
};

const getData = () => {
  axios
    .get(url.value)
    .then((response) => {
      resp.value = response.data.games;
    })
    .then(() => {
      processData();
    })
    .then(() => {
      if (monthsToAnalyze > 0) {
        monthsToAnalyze--;
        now.value = new Date(now.value.getFullYear(), now.value.getMonth() - 1);
        getData();
      } else {
        // Things to run after all loops finish
        generateCharts();
        btnText.value = "👇🏻 Scroll down for charts 👇🏻";
        loading.value = false;
      }
    });
};

const roundRating = (rating, bucket = 100) => {
  return Math.round(rating / bucket) * bucket;
};

const processData = () => {
  resp.value.forEach((game) => {
    // don't include game that aren't in a selected format
    if (![...format.value].includes(game.time_class)) {
      droppedgames.value++;
    } else {
      // check for player color
      if (game.white.username.toLowerCase() === user.value.toLowerCase()) {
        // user played as white
        let roundedRating = roundRating(game.black.rating, bucketSize.value);

        if (game.white.result === "win") {
          dataset.value.white.wins[roundedRating] = dataset.value.white.wins[
            roundedRating
          ]
            ? dataset.value.white.wins[roundedRating] + 1
            : 1;
        } else if (
          [
            "checkmated",
            "timeout",
            "resigned",
            "lose",
            "kingofthehill",
          ].includes(game.white.result)
        ) {
          dataset.value.white.losses[roundedRating] = dataset.value.white
            .losses[roundedRating]
            ? dataset.value.white.losses[roundedRating] + 1
            : 1;
        } else {
          dataset.value.white.draws[roundedRating] = dataset.value.white.draws[
            roundedRating
          ]
            ? dataset.value.white.draws[roundedRating] + 1
            : 1;
        }
      } else {
        // user played as black
        let roundedRating = roundRating(game.white.rating, bucketSize.value);
        if (game.black.result === "win") {
          dataset.value.black.wins[roundedRating] = dataset.value.black.wins[
            roundedRating
          ]
            ? dataset.value.black.wins[roundedRating] + 1
            : 1;
        } else if (
          [
            "checkmated",
            "timeout",
            "resigned",
            "lose",
            "kingofthehill",
          ].includes(game.black.result)
        ) {
          dataset.value.black.losses[roundedRating] = dataset.value.black
            .losses[roundedRating]
            ? dataset.value.black.losses[roundedRating] + 1
            : 1;
        } else {
          dataset.value.black.draws[roundedRating] = dataset.value.black.draws[
            roundedRating
          ]
            ? dataset.value.black.draws[roundedRating] + 1
            : 1;
        }
      }
    }
  });
  totalgames.value = totalgames.value + resp.value.length;
};

// All that chart stuff 📈

const generateCharts = () => {
  // Intermediary Function to call all chart generators
  generateWinsBoth();
  generateNetWins();
};

let winsChart = null;

const generateWinsBoth = () => {
  let ctxBoth = document.getElementById("bothColors");
  let labels = [
    ...new Set([
      ...Object.keys(dataset.value.black.wins),
      ...Object.keys(dataset.value.black.losses),
      ...Object.keys(dataset.value.black.draws),
      ...Object.keys(dataset.value.white.wins),
      ...Object.keys(dataset.value.white.losses),
      ...Object.keys(dataset.value.white.draws),
    ]),
  ];

  labels.sort((a, b) => parseInt(a) - parseInt(b));

  // [White/black]
  let datasets = [
    {
      label: "White Wins",
      backgroundColor: "hsla(180, 48.1%, 52.4%, 0.5)",
      borderColor: "lightgray",
      borderWidth: "0",
      data: [],
    },
    {
      label: "White Losses",
      backgroundColor: "hsla(347.3, 100%, 69.4%, 0.5)",
      borderColor: "lightgray",
      borderWidth: "0",
      data: [],
    },
    {
      label: "White Draws",
      backgroundColor: "hsla(29.8, 100%, 62.5%, 0.5)",
      borderColor: "lightgray",
      borderWidth: "0",
      data: [],
    },
    {
      label: "Black Wins",
      backgroundColor: "hsla(180, 48.1%, 52.4%, 0.9)",
      borderColor: "black",
      borderWidth: "0",
      data: [],
    },
    {
      label: "Black Losses",
      backgroundColor: "hsla(347.3, 100%, 69.4%, 0.9)",
      borderColor: "black",
      borderWidth: "0",
      data: [],
    },
    {
      label: "Black Draws",
      backgroundColor: "hsla(29.8, 100%, 62.5%, 0.9)",
      borderColor: "black",
      borderWidth: "0",
      data: [],
    },
  ];

  labels.forEach((label) => {
    //wins
    if (dataset.value.white.wins[label]) {
      datasets[0].data.push(dataset.value.white.wins[label]);
    } else {
      datasets[0].data.push(0);
    }

    if (dataset.value.black.wins[label]) {
      datasets[3].data.push(dataset.value.black.wins[label]);
    } else {
      datasets[3].data.push(0);
    }

    // losses
    if (dataset.value.white.losses[label]) {
      datasets[1].data.push(dataset.value.white.losses[label]);
    } else {
      datasets[1].data.push(0);
    }

    if (dataset.value.black.losses[label]) {
      datasets[4].data.push(dataset.value.black.losses[label]);
    } else {
      datasets[4].data.push(0);
    }

    // draws
    if (dataset.value.white.draws[label]) {
      datasets[2].data.push(dataset.value.white.draws[label]);
    } else {
      datasets[2].data.push(0);
    }

    if (dataset.value.black.draws[label]) {
      datasets[5].data.push(dataset.value.black.draws[label]);
    } else {
      datasets[5].data.push(0);
    }
  });

  let data = {
    labels: [...labels],
    datasets: [...datasets],
  };
  if (Chart.getChart("bothColors")) {
    winsChart.data = data;
    winsChart.update();
  } else {
    winsChart = new Chart(ctxBoth, {
      type: "bar",
      data: data,
      options: {
        barValueSpacing: 5,
        plugins: {
          legend: {
            labels: {
              color: function () {
                return theme.value === "light" ? "black" : "#e5e5e5";
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: function () {
                return theme.value === "light"
                  ? "#e5e5e5"
                  : "hsla(0, 0%, 65.3%, 35%)";
              },
            },
            ticks: {
              color: function () {
                return theme.value === "light" ? "black" : "#e5e5e5";
              },
            },
          },
          y: {
            display: true,
            grid: {
              color: function () {
                return theme.value === "light"
                  ? "#e5e5e5"
                  : "hsla(0, 0%, 65.3%, 35%)";
              },
            },
            ticks: {
              color: function () {
                return theme.value === "light" ? "black" : "#e5e5e5";
              },
            },
          },
        },
      },
    });
  }
};

let netChart = null;
let ww = ref(),
  wb = ref(),
  lb = ref(),
  lw = ref(),
  w = ref(),
  l = ref();
const generateNetWins = () => {
  let ctxNet = document.getElementById("netWins");
  let labels = [
    ...new Set([
      ...Object.keys(dataset.value.black.wins),
      ...Object.keys(dataset.value.black.losses),
      ...Object.keys(dataset.value.black.draws),
      ...Object.keys(dataset.value.white.wins),
      ...Object.keys(dataset.value.white.losses),
      ...Object.keys(dataset.value.white.draws),
    ]),
  ];

  labels.sort((a, b) => parseInt(a) - parseInt(b));

  // [White/black]
  let datasets = [
    {
      label: "White",
      // backgroundColor: "hsla(180, 48.1%, 52.4%, 0.3)",
      backgroundColor: function (context) {
        let index = context.dataIndex;
        let value = context.dataset.data[index];

        return value < 0
          ? "hsla(347.3, 100%, 69.4%, 0.3)"
          : "hsla(180, 48.1%, 52.4%, 0.3)";
      },
      data: [],
    },
    {
      label: "Black",
      backgroundColor: function (context) {
        let index = context.dataIndex;
        let value = context.dataset.data[index];

        return value < 0
          ? "hsla(347.3, 100%, 69.4%, 0.5)"
          : "hsla(180, 48.1%, 52.4%, 0.5)";
      },
      data: [],
    },
    {
      label: "Combined",
      backgroundColor: function (context) {
        let index = context.dataIndex;
        let value = context.dataset.data[index];

        return value < 0
          ? "hsla(347.3, 100%, 69.4%, 0.7)"
          : "hsla(180, 48.1%, 52.4%, 0.7)";
      },
      data: [],
    },
  ];

  labels.forEach((label) => {
    //White
    if (dataset.value.white.wins[label] || dataset.value.white.losses[label]) {
      w.value = dataset.value.white.wins[label]
        ? dataset.value.white.wins[label]
        : 0;
      l.value = dataset.value.white.losses[label]
        ? dataset.value.white.losses[label]
        : 0;

      datasets[0].data.push(w.value - l.value);
    } else {
      datasets[0].data.push(0);
    }

    //Black
    if (dataset.value.black.wins[label] || dataset.value.black.losses[label]) {
      w.value = dataset.value.black.wins[label]
        ? dataset.value.black.wins[label]
        : 0;
      l.value = dataset.value.black.losses[label]
        ? dataset.value.black.losses[label]
        : 0;

      datasets[1].data.push(w.value - l.value);
    } else {
      datasets[1].data.push(0);
    }

    //total
    // No need for ifs here - we have a label, so games exist

    wb.value = dataset.value.black.wins[label]
      ? dataset.value.black.wins[label]
      : 0;
    lb.value = dataset.value.black.losses[label]
      ? dataset.value.black.losses[label]
      : 0;

    ww.value = dataset.value.white.wins[label]
      ? dataset.value.white.wins[label]
      : 0;
    lw.value = dataset.value.white.losses[label]
      ? dataset.value.white.losses[label]
      : 0;

    datasets[2].data.push(ww.value + wb.value - lw.value - lb.value);
  });

  let data = {
    labels: [...labels],
    datasets: [...datasets],
  };

  if (Chart.getChart("netWins")) {
    netChart.data = data;
    netChart.update();
  } else {
    netChart = new Chart(ctxNet, {
      type: "bar",
      data: data,
      options: {
        barValueSpacing: 0,
        barPercentage: 1,
        categoryPercentage: 0.9,
        plugins: {
          legend: {
            labels: {
              color: function () {
                return theme.value === "light" ? "black" : "#e5e5e5";
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: function () {
                return theme.value === "light"
                  ? "#e5e5e5"
                  : "hsla(0, 0%, 65.3%, 35%)";
              },
            },
            ticks: {
              color: function () {
                return theme.value === "light" ? "black" : "#e5e5e5";
              },
            },
          },
          y: {
            display: true,
            grid: {
              color: function () {
                return theme.value === "light"
                  ? "#e5e5e5"
                  : "hsla(0, 0%, 65.3%, 35%)";
              },
            },
            ticks: {
              color: function () {
                return theme.value === "light" ? "black" : "#e5e5e5";
              },
            },
          },
        },
      },
    });
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
}
</style>
